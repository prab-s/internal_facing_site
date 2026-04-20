<?php
/**
 * Plugin Name: Internal Facing API
 * Description: Customer-facing WordPress bridge for Internal Facing products, series, PDFs, detail pages, and picker/search UI. Preferred shortcodes: [internal_facing_products], [internal_facing_product], [internal_facing_series], [internal_facing_product_picker], [internal_facing_product_types_nav].
 * Version: 0.2.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/*
|--------------------------------------------------------------------------
| Plugin overview
|--------------------------------------------------------------------------
|
| This plugin connects WordPress to the Internal Facing FastAPI backend.
|
| Main backend endpoints used:
| - GET /api/cms/products
| - GET /api/cms/products/{product_id}
| - GET /api/cms/series
| - GET /api/cms/series/{series_id}
| - GET /api/cms/product-types
| - GET /api/cms/media/product_images/{file_name}
| - GET /api/cms/media/product_graphs/{file_name}
| - GET /api/cms/media/product_pdfs/{file_name}
| - GET /api/cms/media/series_graphs/{file_name}
| - GET /api/cms/media/series_pdfs/{file_name}
|
| Public URL routes added by this plugin:
| - /products/type/{product_type_key}/
| - /products/{product_id}/
| - /series/{series_id}/
|
| Recommended shortcodes:
| - [internal_facing_product_types_nav]
| - [internal_facing_products]
| - [internal_facing_product id="1"]
| - [internal_facing_series product_type="fan"]
| - [internal_facing_series id="1"]
| - [internal_facing_product_picker]
|
*/

function internal_facing_api_base_url() {
    if (defined('FAN_GRAPHS_INTERNAL_API_BASE_URL')) {
        return rtrim(FAN_GRAPHS_INTERNAL_API_BASE_URL, '/');
    }
    return '';
}

function internal_facing_api_token() {
    if (defined('FAN_GRAPHS_API_TOKEN')) {
        return FAN_GRAPHS_API_TOKEN;
    }
    return '';
}

function internal_facing_slug_token($value) {
    $value = sanitize_title((string) $value);
    return $value !== '' ? $value : 'item';
}

function internal_facing_get_query_value($key, $default = '') {
    return isset($_GET[$key]) ? wp_unslash($_GET[$key]) : $default;
}

function internal_facing_product_route_slug($product) {
    if (is_array($product)) {
        return internal_facing_slug_token($product['model'] ?? '');
    }
    return internal_facing_slug_token((string) $product);
}

function internal_facing_series_route_slug($series) {
    if (is_array($series)) {
        return internal_facing_slug_token(trim((string) (($series['product_type_key'] ?? '') . ' ' . ($series['name'] ?? ''))));
    }
    return internal_facing_slug_token((string) $series);
}

function internal_facing_product_permalink($product) {
    return home_url('/products/' . rawurlencode(internal_facing_product_route_slug($product)) . '/');
}

function internal_facing_series_permalink($series) {
    return home_url('/series/' . rawurlencode(internal_facing_series_route_slug($series)) . '/');
}

function internal_facing_product_type_permalink($product_type_key) {
    return home_url('/products/type/' . rawurlencode((string) $product_type_key) . '/');
}

function internal_facing_resolve_media_url($path) {
    $path = trim((string) $path);
    if ($path === '') {
        return '';
    }

    if (preg_match('#^/api/cms/media/(product_images|product_graphs|product_pdfs|series_graphs|series_pdfs)/([^?]+)(\\?.*)?$#', $path, $matches)) {
        $kind = $matches[1];
        $file_name = $matches[2];
        $query_args = array(
            'internal_facing_media' => $kind . '/' . $file_name,
        );
        if (!empty($matches[3])) {
            parse_str(ltrim($matches[3], '?'), $extra_query_args);
            if (is_array($extra_query_args)) {
                $query_args = array_merge($query_args, $extra_query_args);
            }
        }
        return add_query_arg($query_args, home_url('/'));
    }

    if (preg_match('#^https?://#i', $path)) {
        return $path;
    }

    $base_url = internal_facing_api_base_url();
    if ($base_url === '') {
        return $path;
    }

    if ($path[0] !== '/') {
        $path = '/' . $path;
    }

    return $base_url . $path;
}

function internal_facing_maybe_proxy_media() {
    $media = isset($_GET['internal_facing_media']) ? wp_unslash($_GET['internal_facing_media']) : '';
    if ($media === '') {
        $media = isset($_GET['fan_graphs_media']) ? wp_unslash($_GET['fan_graphs_media']) : '';
    }
    if ($media === '') {
        return;
    }

    $media = trim((string) $media, '/');
    if (!preg_match('#^(product_images|product_graphs|product_pdfs|series_graphs|series_pdfs)/([^/]+)$#', $media, $matches)) {
        status_header(404);
        exit;
    }

    $kind = $matches[1];
    $file_name = sanitize_file_name($matches[2]);
    if ($file_name === '') {
        status_header(404);
        exit;
    }

    $url = internal_facing_api_base_url() . '/api/cms/media/' . rawurlencode($kind) . '/' . rawurlencode($file_name);
    $query_params = $_GET;
    unset($query_params['internal_facing_media'], $query_params['fan_graphs_media']);
    if (!empty($query_params)) {
        $url = add_query_arg($query_params, $url);
    }

    $response = wp_remote_get($url, array(
        'timeout' => 20,
        'redirection' => 3,
    ));

    if (is_wp_error($response)) {
        status_header(502);
        echo esc_html($response->get_error_message());
        exit;
    }

    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $content_type = wp_remote_retrieve_header($response, 'content-type');
    $cache_control = wp_remote_retrieve_header($response, 'cache-control');

    status_header($status_code);
    if ($content_type) {
        header('Content-Type: ' . $content_type);
    }
    if ($cache_control) {
        header('Cache-Control: ' . $cache_control);
    }

    echo $body;
    exit;
}
add_action('template_redirect', 'internal_facing_maybe_proxy_media', 0);

function internal_facing_api_request($path, $query = array()) {
    $base_url = internal_facing_api_base_url();
    $token = internal_facing_api_token();

    if (!$base_url || !$token) {
        return new WP_Error('internal_facing_config', 'Internal Facing API is not configured.');
    }

    $url = $base_url . $path;
    if (!empty($query)) {
        $url = add_query_arg($query, $url);
    }

    $response = wp_remote_get($url, array(
        'timeout' => 20,
        'headers' => array(
            'Authorization' => 'Bearer ' . $token,
        ),
    ));

    if (is_wp_error($response)) {
        return $response;
    }

    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    if ($status_code < 200 || $status_code >= 300) {
        return new WP_Error('internal_facing_api', 'Internal Facing API request failed: ' . $status_code);
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        return new WP_Error('internal_facing_json', 'Internal Facing API returned invalid JSON.');
    }

    return $decoded;
}

function internal_facing_find_product_by_slug($slug) {
    $products = internal_facing_api_request('/api/cms/products');
    if (is_wp_error($products) || !is_array($products)) {
        return $products;
    }

    foreach ($products as $product) {
        if (internal_facing_product_route_slug($product) === $slug) {
            return $product;
        }
    }

    return new WP_Error('internal_facing_not_found', 'Product not found.');
}

function internal_facing_find_series_by_slug($slug) {
    $series_list = internal_facing_api_request('/api/cms/series');
    if (is_wp_error($series_list) || !is_array($series_list)) {
        return $series_list;
    }

    foreach ($series_list as $series) {
        if (internal_facing_series_route_slug($series) === $slug) {
            return $series;
        }
    }

    return new WP_Error('internal_facing_not_found', 'Series not found.');
}

function internal_facing_parse_parameter_filter_shortcut($raw_filters, $mode) {
    $raw_filters = trim((string) $raw_filters);
    if ($raw_filters === '') {
        return array();
    }

    $filters = array();
    foreach (explode(';', $raw_filters) as $raw_filter) {
        $raw_filter = trim($raw_filter);
        if ($raw_filter === '') {
            continue;
        }

        $parts = array_map('trim', explode('|', $raw_filter));
        if ($mode === 'string' && count($parts) >= 3) {
            $filters[] = array(
                'group_name' => $parts[0],
                'parameter_name' => $parts[1],
                'value_string' => $parts[2],
            );
            continue;
        }

        if ($mode === 'number' && count($parts) >= 4) {
            $filters[] = array(
                'group_name' => $parts[0],
                'parameter_name' => $parts[1],
                'min_number' => $parts[2] !== '' ? floatval($parts[2]) : null,
                'max_number' => $parts[3] !== '' ? floatval($parts[3]) : null,
            );
        }
    }

    return $filters;
}

function internal_facing_build_parameter_filters_query($atts) {
    $raw_json = trim((string) ($atts['parameter_filters'] ?? ''));
    if ($raw_json !== '') {
        return $raw_json;
    }

    $filters = array_merge(
        internal_facing_parse_parameter_filter_shortcut($atts['parameter_string_filters'] ?? '', 'string'),
        internal_facing_parse_parameter_filter_shortcut($atts['parameter_number_filters'] ?? '', 'number')
    );

    return !empty($filters) ? wp_json_encode($filters) : '';
}

function internal_facing_render_rich_section($title, $html) {
    if (!$html) {
        return '';
    }

    ob_start();
    ?>
    <section class="internal-facing-card__section">
      <h4 class="internal-facing-card__section-title"><?php echo esc_html($title); ?></h4>
      <div class="internal-facing-card__richtext"><?php echo wp_kses_post($html); ?></div>
    </section>
    <?php
    return ob_get_clean();
}

function internal_facing_format_parameter_value($parameter) {
    $value_string = isset($parameter['value_string']) ? trim((string) $parameter['value_string']) : '';
    $value_number = $parameter['value_number'] ?? null;
    $unit = isset($parameter['unit']) ? trim((string) $parameter['unit']) : '';

    if ($value_string !== '') {
        return $value_string;
    }
    if ($value_number !== null && $value_number !== '') {
        return (string) $value_number . ($unit !== '' ? ' ' . $unit : '');
    }
    return '—';
}

function internal_facing_render_parameter_groups($product) {
    $groups = $product['parameter_groups'] ?? array();
    if (!is_array($groups) || empty($groups)) {
        return '';
    }

    ob_start();
    ?>
    <div class="internal-facing-card__sections">
      <?php foreach ($groups as $group) : ?>
        <section class="internal-facing-card__section">
          <h4 class="internal-facing-card__section-title"><?php echo esc_html($group['group_name'] ?? 'Specifications'); ?></h4>
          <dl class="internal-facing-card__specs">
            <?php foreach (($group['parameters'] ?? array()) as $parameter) : ?>
              <?php $name = trim((string) ($parameter['parameter_name'] ?? '')); ?>
              <?php if ($name === '') { continue; } ?>
              <div>
                <dt><?php echo esc_html($name); ?></dt>
                <dd><?php echo esc_html(internal_facing_format_parameter_value($parameter)); ?></dd>
              </div>
            <?php endforeach; ?>
          </dl>
        </section>
      <?php endforeach; ?>
    </div>
    <?php
    return ob_get_clean();
}

function internal_facing_render_product_card($product, $detailed = false) {
    $product_id = intval($product['id'] ?? 0);
    $model = esc_html($product['model'] ?? '');
    $product_type = esc_html($product['product_type_label'] ?? $product['product_type_key'] ?? '');
    $series_name = esc_html($product['series_name'] ?? '');
    $mounting_style = esc_html($product['mounting_style'] ?? '');
    $discharge_type = esc_html($product['discharge_type'] ?? '');
    $graph_image_url = esc_url(internal_facing_resolve_media_url($product['graph_image_url'] ?? ''));
    $product_pdf_url = esc_url(internal_facing_resolve_media_url($product['product_pdf_url'] ?? ''));
    $primary_product_image_url = esc_url(internal_facing_resolve_media_url($product['primary_product_image_url'] ?? ''));
    $detail_url = $product_id ? esc_url(internal_facing_product_permalink($product)) : '';

    ob_start();
    ?>
    <article class="internal-facing-card">
      <?php if ($primary_product_image_url !== '') : ?>
        <img class="internal-facing-card__image" src="<?php echo $primary_product_image_url; ?>" alt="<?php echo $model; ?>" />
      <?php endif; ?>
      <h3 class="internal-facing-card__title"><?php echo $model; ?></h3>
      <?php if ($product_type !== '') : ?>
        <p class="internal-facing-card__type"><?php echo $product_type; ?></p>
      <?php endif; ?>
      <?php if ($series_name !== '') : ?>
        <p class="internal-facing-card__series"><?php echo $series_name; ?></p>
      <?php endif; ?>
      <dl class="internal-facing-card__meta">
        <?php if ($mounting_style !== '') : ?>
          <div><dt>Mounting</dt><dd><?php echo $mounting_style; ?></dd></div>
        <?php endif; ?>
        <?php if ($discharge_type !== '') : ?>
          <div><dt>Discharge</dt><dd><?php echo $discharge_type; ?></dd></div>
        <?php endif; ?>
      </dl>
      <div class="internal-facing-card__actions">
        <?php if ($detail_url !== '') : ?>
          <a href="<?php echo $detail_url; ?>">View details</a>
        <?php endif; ?>
        <?php if ($graph_image_url !== '') : ?>
          <a href="<?php echo $graph_image_url; ?>">Download graph</a>
        <?php endif; ?>
        <?php if ($product_pdf_url !== '') : ?>
          <a href="<?php echo $product_pdf_url; ?>">Download PDF</a>
        <?php endif; ?>
      </div>
      <?php if ($detailed) : ?>
        <?php echo internal_facing_render_rich_section('Description1', $product['description1_html'] ?? ''); ?>
        <?php echo internal_facing_render_rich_section('Description2', $product['description2_html'] ?? ''); ?>
        <?php echo internal_facing_render_rich_section('Description3', $product['description3_html'] ?? ''); ?>
        <?php echo internal_facing_render_parameter_groups($product); ?>
        <?php echo internal_facing_render_rich_section('Comments', $product['comments_html'] ?? ''); ?>
        <?php if ($graph_image_url !== '') : ?>
          <section class="internal-facing-card__section">
            <h4 class="internal-facing-card__section-title">Product Graph</h4>
            <div class="internal-facing-graph-preview">
              <img src="<?php echo $graph_image_url; ?>" alt="<?php echo $model; ?> graph" />
            </div>
          </section>
        <?php endif; ?>
        <?php if ($product_pdf_url !== '') : ?>
          <section class="internal-facing-card__section">
            <h4 class="internal-facing-card__section-title">Product PDF</h4>
            <div class="internal-facing-pdf-preview">
              <iframe src="<?php echo $product_pdf_url; ?>" title="<?php echo $model; ?> PDF preview" loading="lazy"></iframe>
            </div>
          </section>
        <?php endif; ?>
      <?php endif; ?>
    </article>
    <?php
    return ob_get_clean();
}

function internal_facing_render_series_card($series, $detailed = false) {
    $series_id = intval($series['id'] ?? 0);
    $name = esc_html($series['name'] ?? '');
    $product_type = esc_html($series['product_type_label'] ?? $series['product_type_key'] ?? '');
    $product_count = intval($series['product_count'] ?? 0);
    $series_graph_url = esc_url(internal_facing_resolve_media_url($series['series_graph_image_url'] ?? ''));
    $series_pdf_url = esc_url(internal_facing_resolve_media_url($series['series_pdf_url'] ?? ''));
    $detail_url = $series_id ? esc_url(internal_facing_series_permalink($series)) : '';

    ob_start();
    ?>
    <article class="internal-facing-card">
      <h3 class="internal-facing-card__title"><?php echo $name; ?></h3>
      <?php if ($product_type !== '') : ?>
        <p class="internal-facing-card__type"><?php echo $product_type; ?></p>
      <?php endif; ?>
      <dl class="internal-facing-card__meta">
        <div><dt>Products</dt><dd><?php echo esc_html((string) $product_count); ?></dd></div>
      </dl>
      <div class="internal-facing-card__actions">
        <?php if ($detail_url !== '') : ?>
          <a href="<?php echo $detail_url; ?>">View series</a>
        <?php endif; ?>
        <?php if ($series_graph_url !== '') : ?>
          <a href="<?php echo $series_graph_url; ?>">Download graph</a>
        <?php endif; ?>
        <?php if ($series_pdf_url !== '') : ?>
          <a href="<?php echo $series_pdf_url; ?>">Download PDF</a>
        <?php endif; ?>
      </div>
      <?php if ($detailed) : ?>
        <?php echo internal_facing_render_rich_section('Description1', $series['description1_html'] ?? ''); ?>
        <?php echo internal_facing_render_rich_section('Description2', $series['description2_html'] ?? ''); ?>
        <?php echo internal_facing_render_rich_section('Description3', $series['description3_html'] ?? ''); ?>
        <?php echo internal_facing_render_rich_section('Comments', $series['comments_html'] ?? ''); ?>
        <?php if ($series_graph_url !== '') : ?>
          <section class="internal-facing-card__section">
            <h4 class="internal-facing-card__section-title">Series Graph</h4>
            <div class="internal-facing-graph-preview">
              <img src="<?php echo $series_graph_url; ?>" alt="<?php echo $name; ?> graph" />
            </div>
          </section>
        <?php endif; ?>
        <?php if ($series_pdf_url !== '') : ?>
          <section class="internal-facing-card__section">
            <h4 class="internal-facing-card__section-title">Series PDF</h4>
            <div class="internal-facing-pdf-preview">
              <iframe src="<?php echo $series_pdf_url; ?>" title="<?php echo $name; ?> PDF preview" loading="lazy"></iframe>
            </div>
          </section>
        <?php endif; ?>
        <?php if (!empty($series['products']) && is_array($series['products'])) : ?>
          <section class="internal-facing-card__section">
            <h4 class="internal-facing-card__section-title">Products in this series</h4>
            <div class="internal-facing-grid">
              <?php foreach ($series['products'] as $product) : ?>
                <?php echo internal_facing_render_product_card($product, false); ?>
              <?php endforeach; ?>
            </div>
          </section>
        <?php endif; ?>
      <?php endif; ?>
    </article>
    <?php
    return ob_get_clean();
}

function internal_facing_shortcode_products($atts) {
    $atts = shortcode_atts(array(
        'limit' => 12,
        'search' => '',
        'product_type' => '',
        'series' => '',
        'mounting_style' => '',
        'discharge_type' => '',
        'parameter_filters' => '',
        'parameter_string_filters' => '',
        'parameter_number_filters' => '',
    ), $atts, 'internal_facing_products');

    $parameter_filters = internal_facing_build_parameter_filters_query($atts);
    $query = array(
        'search' => $atts['search'],
        'product_type_key' => $atts['product_type'],
        'series_name' => $atts['series'],
        'mounting_style' => $atts['mounting_style'],
        'discharge_type' => $atts['discharge_type'],
        'parameter_filters' => $parameter_filters,
    );

    $result = internal_facing_api_request('/api/cms/products', $query);
    if (is_wp_error($result)) {
        return '<div class="internal-facing-error">' . esc_html($result->get_error_message()) . '</div>';
    }

    $products = array_slice($result, 0, intval($atts['limit']));

    ob_start();
    ?>
    <?php if (empty($products)) : ?>
      <div class="internal-facing-empty-state">
        No products matched the current settings.
      </div>
    <?php else : ?>
      <div class="internal-facing-grid">
        <?php foreach ($products as $product) : ?>
          <?php echo internal_facing_render_product_card($product, false); ?>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
    <?php
    return ob_get_clean();
}

function internal_facing_shortcode_product($atts) {
    $atts = shortcode_atts(array(
        'id' => '',
    ), $atts, 'internal_facing_product');

    if ($atts['id'] === '') {
        return '<div class="internal-facing-error">Missing product id.</div>';
    }

    $result = internal_facing_api_request('/api/cms/products/' . intval($atts['id']));
    if (is_wp_error($result)) {
        return '<div class="internal-facing-error">' . esc_html($result->get_error_message()) . '</div>';
    }

    return internal_facing_render_product_card($result, true);
}

function internal_facing_shortcode_series($atts) {
    $atts = shortcode_atts(array(
        'id' => '',
        'product_type' => '',
        'limit' => 99,
    ), $atts, 'internal_facing_series');

    if ($atts['id'] !== '') {
        $result = internal_facing_api_request('/api/cms/series/' . intval($atts['id']));
        if (is_wp_error($result)) {
            return '<div class="internal-facing-error">' . esc_html($result->get_error_message()) . '</div>';
        }
        return internal_facing_render_series_card($result, true);
    }

    $result = internal_facing_api_request('/api/cms/series', array(
        'product_type_key' => $atts['product_type'],
    ));
    if (is_wp_error($result)) {
        return '<div class="internal-facing-error">' . esc_html($result->get_error_message()) . '</div>';
    }

    $series_list = array_slice($result, 0, intval($atts['limit']));
    ob_start();
    ?>
    <?php if (empty($series_list)) : ?>
      <div class="internal-facing-empty-state">
        No series records were found<?php echo $atts['product_type'] !== '' ? ' for product type "' . esc_html($atts['product_type']) . '"' : ''; ?>.
        Create a series record in the Internal Facing editor and make sure products are assigned to it.
      </div>
    <?php else : ?>
      <div class="internal-facing-grid">
        <?php foreach ($series_list as $series) : ?>
          <?php echo internal_facing_render_series_card($series, false); ?>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
    <?php
    return ob_get_clean();
}

function internal_facing_shortcode_product_types_nav($atts) {
    $atts = shortcode_atts(array(
        'class' => '',
    ), $atts, 'internal_facing_product_types_nav');

    $product_types = internal_facing_api_request('/api/cms/product-types');
    if (is_wp_error($product_types)) {
        return '<div class="internal-facing-error">' . esc_html($product_types->get_error_message()) . '</div>';
    }

    ob_start();
    ?>
    <nav class="internal-facing-type-nav <?php echo esc_attr($atts['class']); ?>">
      <?php foreach ($product_types as $product_type) : ?>
        <a href="<?php echo esc_url(internal_facing_product_type_permalink($product_type['key'] ?? '')); ?>">
          <?php echo esc_html($product_type['label'] ?? $product_type['key'] ?? 'Type'); ?>
        </a>
      <?php endforeach; ?>
    </nav>
    <?php
    return ob_get_clean();
}

function internal_facing_collect_picker_metadata($products) {
    $metadata = array(
        'mounting_styles' => array(),
        'discharge_types' => array(),
        'parameter_fields' => array(),
    );

    foreach ($products as $product) {
        $mounting = trim((string) ($product['mounting_style'] ?? ''));
        if ($mounting !== '') {
            $metadata['mounting_styles'][$mounting] = $mounting;
        }

        $discharge = trim((string) ($product['discharge_type'] ?? ''));
        if ($discharge !== '') {
            $metadata['discharge_types'][$discharge] = $discharge;
        }

        foreach (($product['parameter_groups'] ?? array()) as $group) {
            $group_name = trim((string) ($group['group_name'] ?? ''));
            if ($group_name === '') {
                continue;
            }

            foreach (($group['parameters'] ?? array()) as $parameter) {
                $parameter_name = trim((string) ($parameter['parameter_name'] ?? ''));
                if ($parameter_name === '') {
                    continue;
                }

                $field_key = internal_facing_slug_token($group_name) . '__' . internal_facing_slug_token($parameter_name);
                if (!isset($metadata['parameter_fields'][$field_key])) {
                    $metadata['parameter_fields'][$field_key] = array(
                        'group_name' => $group_name,
                        'parameter_name' => $parameter_name,
                        'kind' => null,
                        'values' => array(),
                        'min' => null,
                        'max' => null,
                        'unit' => '',
                    );
                }

                $value_string = trim((string) ($parameter['value_string'] ?? ''));
                $value_number = $parameter['value_number'] ?? null;
                $unit = trim((string) ($parameter['unit'] ?? ''));

                if ($value_string !== '') {
                    $metadata['parameter_fields'][$field_key]['kind'] = $metadata['parameter_fields'][$field_key]['kind'] ?: 'string';
                    $metadata['parameter_fields'][$field_key]['values'][$value_string] = $value_string;
                } elseif ($value_number !== null && $value_number !== '') {
                    $metadata['parameter_fields'][$field_key]['kind'] = $metadata['parameter_fields'][$field_key]['kind'] ?: 'number';
                    $number = floatval($value_number);
                    $metadata['parameter_fields'][$field_key]['min'] = $metadata['parameter_fields'][$field_key]['min'] === null ? $number : min($metadata['parameter_fields'][$field_key]['min'], $number);
                    $metadata['parameter_fields'][$field_key]['max'] = $metadata['parameter_fields'][$field_key]['max'] === null ? $number : max($metadata['parameter_fields'][$field_key]['max'], $number);
                    if ($unit !== '') {
                        $metadata['parameter_fields'][$field_key]['unit'] = $unit;
                    }
                }
            }
        }
    }

    ksort($metadata['mounting_styles']);
    ksort($metadata['discharge_types']);
    foreach ($metadata['parameter_fields'] as $key => $field) {
        if (!empty($field['values'])) {
            ksort($field['values']);
        }
        $metadata['parameter_fields'][$key] = $field;
    }

    return $metadata;
}

function internal_facing_build_picker_parameter_filters($metadata, $request_prefix) {
    $filters = array();

    foreach (($metadata['parameter_fields'] ?? array()) as $field_key => $field) {
        if (($field['kind'] ?? '') === 'string') {
            $value = trim((string) internal_facing_get_query_value($request_prefix . 'spec_' . $field_key, ''));
            if ($value !== '') {
                $filters[] = array(
                    'group_name' => $field['group_name'],
                    'parameter_name' => $field['parameter_name'],
                    'value_string' => $value,
                );
            }
            continue;
        }

        if (($field['kind'] ?? '') === 'number') {
            $min_raw = trim((string) internal_facing_get_query_value($request_prefix . 'spec_' . $field_key . '_min', ''));
            $max_raw = trim((string) internal_facing_get_query_value($request_prefix . 'spec_' . $field_key . '_max', ''));
            if ($min_raw === '' && $max_raw === '') {
                continue;
            }
            $filters[] = array(
                'group_name' => $field['group_name'],
                'parameter_name' => $field['parameter_name'],
                'min_number' => $min_raw !== '' ? floatval($min_raw) : null,
                'max_number' => $max_raw !== '' ? floatval($max_raw) : null,
            );
        }
    }

    return $filters;
}

function internal_facing_shortcode_product_picker($atts) {
    $atts = shortcode_atts(array(
        'request_prefix' => 'ifp_',
    ), $atts, 'internal_facing_product_picker');

    $prefix = (string) $atts['request_prefix'];
    $selected_type = trim((string) internal_facing_get_query_value($prefix . 'product_type', ''));
    $selected_mounting = trim((string) internal_facing_get_query_value($prefix . 'mounting_style', ''));
    $selected_discharge = trim((string) internal_facing_get_query_value($prefix . 'discharge_type', ''));

    $product_types = internal_facing_api_request('/api/cms/product-types');
    if (is_wp_error($product_types)) {
        return '<div class="internal-facing-error">' . esc_html($product_types->get_error_message()) . '</div>';
    }

    $products_for_type = array();
    if ($selected_type !== '') {
        $products_for_type = internal_facing_api_request('/api/cms/products', array(
            'product_type_key' => $selected_type,
        ));
        if (is_wp_error($products_for_type)) {
            return '<div class="internal-facing-error">' . esc_html($products_for_type->get_error_message()) . '</div>';
        }
    }

    $metadata = internal_facing_collect_picker_metadata($products_for_type);
    $parameter_filters = internal_facing_build_picker_parameter_filters($metadata, $prefix);

    $results = array();
    if ($selected_type !== '') {
        $query = array(
            'product_type_key' => $selected_type,
            'mounting_style' => $selected_mounting,
            'discharge_type' => $selected_discharge,
            'parameter_filters' => !empty($parameter_filters) ? wp_json_encode($parameter_filters) : '',
        );
        $results = internal_facing_api_request('/api/cms/products', $query);
        if (is_wp_error($results)) {
            return '<div class="internal-facing-error">' . esc_html($results->get_error_message()) . '</div>';
        }
    }

    ob_start();
    ?>
    <form class="internal-facing-picker" method="get">
      <div class="internal-facing-picker__grid">
        <div>
          <label for="<?php echo esc_attr($prefix . 'product_type'); ?>">Product type</label>
          <select id="<?php echo esc_attr($prefix . 'product_type'); ?>" name="<?php echo esc_attr($prefix . 'product_type'); ?>">
            <option value="">Select product type</option>
            <?php foreach ($product_types as $product_type) : ?>
              <option value="<?php echo esc_attr($product_type['key'] ?? ''); ?>" <?php selected($selected_type, $product_type['key'] ?? ''); ?>>
                <?php echo esc_html($product_type['label'] ?? $product_type['key'] ?? 'Type'); ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <?php if (!empty($metadata['mounting_styles'])) : ?>
          <div>
            <label for="<?php echo esc_attr($prefix . 'mounting_style'); ?>">Mounting style</label>
            <select id="<?php echo esc_attr($prefix . 'mounting_style'); ?>" name="<?php echo esc_attr($prefix . 'mounting_style'); ?>">
              <option value="">Any mounting style</option>
              <?php foreach ($metadata['mounting_styles'] as $value) : ?>
                <option value="<?php echo esc_attr($value); ?>" <?php selected($selected_mounting, $value); ?>><?php echo esc_html($value); ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        <?php endif; ?>

        <?php if (!empty($metadata['discharge_types'])) : ?>
          <div>
            <label for="<?php echo esc_attr($prefix . 'discharge_type'); ?>">Discharge type</label>
            <select id="<?php echo esc_attr($prefix . 'discharge_type'); ?>" name="<?php echo esc_attr($prefix . 'discharge_type'); ?>">
              <option value="">Any discharge type</option>
              <?php foreach ($metadata['discharge_types'] as $value) : ?>
                <option value="<?php echo esc_attr($value); ?>" <?php selected($selected_discharge, $value); ?>><?php echo esc_html($value); ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        <?php endif; ?>
      </div>

      <?php if (!empty($metadata['parameter_fields'])) : ?>
        <div class="internal-facing-picker__spec-grid">
          <?php foreach ($metadata['parameter_fields'] as $field_key => $field) : ?>
            <?php
              $base_name = $prefix . 'spec_' . $field_key;
              $field_label = ($field['group_name'] ?? 'Spec') . ' - ' . ($field['parameter_name'] ?? 'Value');
            ?>
            <?php if (($field['kind'] ?? '') === 'string') : ?>
              <div>
                <label for="<?php echo esc_attr($base_name); ?>"><?php echo esc_html($field_label); ?></label>
                <select id="<?php echo esc_attr($base_name); ?>" name="<?php echo esc_attr($base_name); ?>">
                  <option value="">Any</option>
                  <?php foreach (($field['values'] ?? array()) as $value) : ?>
                    <option value="<?php echo esc_attr($value); ?>" <?php selected(internal_facing_get_query_value($base_name, ''), $value); ?>>
                      <?php echo esc_html($value); ?>
                    </option>
                  <?php endforeach; ?>
                </select>
              </div>
            <?php elseif (($field['kind'] ?? '') === 'number') : ?>
              <div class="internal-facing-picker__range">
                <label><?php echo esc_html($field_label . ($field['unit'] !== '' ? ' (' . $field['unit'] . ')' : '')); ?></label>
                <div class="internal-facing-picker__range-inputs">
                  <input
                    type="number"
                    step="any"
                    name="<?php echo esc_attr($base_name . '_min'); ?>"
                    value="<?php echo esc_attr(internal_facing_get_query_value($base_name . '_min', '')); ?>"
                    placeholder="<?php echo esc_attr($field['min'] !== null ? 'Min ' . $field['min'] : 'Min'); ?>"
                  />
                  <input
                    type="number"
                    step="any"
                    name="<?php echo esc_attr($base_name . '_max'); ?>"
                    value="<?php echo esc_attr(internal_facing_get_query_value($base_name . '_max', '')); ?>"
                    placeholder="<?php echo esc_attr($field['max'] !== null ? 'Max ' . $field['max'] : 'Max'); ?>"
                  />
                </div>
              </div>
            <?php endif; ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <div class="internal-facing-picker__actions">
        <button type="submit">Filter Products</button>
      </div>
    </form>

    <?php if ($selected_type !== '') : ?>
      <div class="internal-facing-picker__results">
        <h3>Matching Products</h3>
        <?php if (empty($results)) : ?>
          <p>No products matched the current picker settings.</p>
        <?php else : ?>
          <div class="internal-facing-grid">
            <?php foreach ($results as $product) : ?>
              <?php echo internal_facing_render_product_card($product, false); ?>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>
    <?php endif; ?>
    <?php

    return ob_get_clean();
}

function internal_facing_render_full_page($title, $content) {
    status_header(200);
    nocache_headers();

    global $wp_query, $post;

    $virtual_post = new stdClass();
    $virtual_post->ID = -999999;
    $virtual_post->post_author = 0;
    $virtual_post->post_date = current_time('mysql');
    $virtual_post->post_date_gmt = current_time('mysql', 1);
    $virtual_post->post_content = $content;
    $virtual_post->post_title = $title;
    $virtual_post->post_excerpt = '';
    $virtual_post->post_status = 'publish';
    $virtual_post->comment_status = 'closed';
    $virtual_post->ping_status = 'closed';
    $virtual_post->post_password = '';
    $virtual_post->post_name = sanitize_title($title);
    $virtual_post->to_ping = '';
    $virtual_post->pinged = '';
    $virtual_post->post_modified = $virtual_post->post_date;
    $virtual_post->post_modified_gmt = $virtual_post->post_date_gmt;
    $virtual_post->post_content_filtered = '';
    $virtual_post->post_parent = 0;
    $virtual_post->guid = home_url(add_query_arg(array(), $_SERVER['REQUEST_URI'] ?? '/'));
    $virtual_post->menu_order = 0;
    $virtual_post->post_type = 'page';
    $virtual_post->post_mime_type = '';
    $virtual_post->comment_count = 0;
    $virtual_post->filter = 'raw';

    $post = new WP_Post($virtual_post);
    setup_postdata($post);

    $wp_query->is_page = true;
    $wp_query->is_singular = true;
    $wp_query->is_home = false;
    $wp_query->is_404 = false;
    $wp_query->found_posts = 1;
    $wp_query->post_count = 1;
    $wp_query->max_num_pages = 1;
    $wp_query->posts = array($post);
    $wp_query->queried_object = $post;
    $wp_query->queried_object_id = $post->ID;

    add_filter('document_title_parts', function ($parts) use ($title) {
        $parts['title'] = $title;
        return $parts;
    }, 20);

    $template = locate_template(array('page.php', 'singular.php', 'index.php'));
    if (!$template) {
        get_header();
        echo '<main class="internal-facing-page-shell"><div class="internal-facing-page-shell__inner">';
        echo $content;
        echo '</div></main>';
        get_sidebar();
        get_footer();
        wp_reset_postdata();
        exit;
    }

    include $template;
    wp_reset_postdata();
    exit;
}

function internal_facing_match_public_route_from_request() {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    if ($request_uri === '') {
        return array(
            'product_id' => 0,
            'series_id' => 0,
            'product_type_key' => '',
            'product_slug' => '',
            'series_slug' => '',
        );
    }

    $request_path = wp_parse_url($request_uri, PHP_URL_PATH);
    if (!is_string($request_path) || $request_path === '') {
        return array(
            'product_id' => 0,
            'series_id' => 0,
            'product_type_key' => '',
            'product_slug' => '',
            'series_slug' => '',
        );
    }

    $home_path = wp_parse_url(home_url('/'), PHP_URL_PATH);
    $normalized_path = $request_path;
    if (is_string($home_path) && $home_path !== '' && $home_path !== '/' && str_starts_with($normalized_path, $home_path)) {
        $normalized_path = substr($normalized_path, strlen($home_path));
    }

    $normalized_path = '/' . trim((string) $normalized_path, '/') . '/';

    $matches = array();
    if (preg_match('#^/products/type/([^/]+)/$#', $normalized_path, $matches)) {
        return array(
            'product_id' => 0,
            'series_id' => 0,
            'product_type_key' => sanitize_key(rawurldecode($matches[1])),
            'product_slug' => '',
            'series_slug' => '',
        );
    }

    if (preg_match('#^/products/([^/]+)/$#', $normalized_path, $matches)) {
        return array(
            'product_id' => ctype_digit($matches[1]) ? intval($matches[1]) : 0,
            'series_id' => 0,
            'product_type_key' => '',
            'product_slug' => ctype_digit($matches[1]) ? '' : sanitize_title(rawurldecode($matches[1])),
            'series_slug' => '',
        );
    }

    if (preg_match('#^/series/([^/]+)/$#', $normalized_path, $matches)) {
        return array(
            'product_id' => 0,
            'series_id' => ctype_digit($matches[1]) ? intval($matches[1]) : 0,
            'product_type_key' => '',
            'product_slug' => '',
            'series_slug' => ctype_digit($matches[1]) ? '' : sanitize_title(rawurldecode($matches[1])),
        );
    }

    return array(
        'product_id' => 0,
        'series_id' => 0,
        'product_type_key' => '',
        'product_slug' => '',
        'series_slug' => '',
    );
}

function internal_facing_maybe_render_public_routes() {
    $product_id = intval(get_query_var('internal_facing_product_id'));
    $series_id = intval(get_query_var('internal_facing_series_id'));
    $product_type_key = trim((string) get_query_var('internal_facing_product_type_key'));
    $product_slug = trim((string) get_query_var('internal_facing_product_slug'));
    $series_slug = trim((string) get_query_var('internal_facing_series_slug'));

    if ($product_id <= 0 && $series_id <= 0 && $product_type_key === '' && $product_slug === '' && $series_slug === '') {
        $fallback_route = internal_facing_match_public_route_from_request();
        $product_id = intval($fallback_route['product_id'] ?? 0);
        $series_id = intval($fallback_route['series_id'] ?? 0);
        $product_type_key = trim((string) ($fallback_route['product_type_key'] ?? ''));
        $product_slug = trim((string) ($fallback_route['product_slug'] ?? ''));
        $series_slug = trim((string) ($fallback_route['series_slug'] ?? ''));
    }

    if ($product_id > 0 || $product_slug !== '') {
        $result = $product_id > 0
            ? internal_facing_api_request('/api/cms/products/' . $product_id)
            : internal_facing_find_product_by_slug($product_slug);
        if (is_wp_error($result)) {
            internal_facing_render_full_page('Product', '<div class="internal-facing-error">' . esc_html($result->get_error_message()) . '</div>');
        }
        internal_facing_render_full_page(($result['model'] ?? 'Product') . ' | Product', internal_facing_render_product_card($result, true));
    }

    if ($series_id > 0 || $series_slug !== '') {
        $result = $series_id > 0
            ? internal_facing_api_request('/api/cms/series/' . $series_id)
            : internal_facing_find_series_by_slug($series_slug);
        if (is_wp_error($result)) {
            internal_facing_render_full_page('Series', '<div class="internal-facing-error">' . esc_html($result->get_error_message()) . '</div>');
        }
        internal_facing_render_full_page(($result['name'] ?? 'Series') . ' | Series', internal_facing_render_series_card($result, true));
    }

    if ($product_type_key !== '') {
        $product_types = internal_facing_api_request('/api/cms/product-types');
        $label = ucfirst(str_replace('_', ' ', $product_type_key));
        if (!is_wp_error($product_types)) {
            foreach ($product_types as $product_type) {
                if (($product_type['key'] ?? '') === $product_type_key) {
                    $label = $product_type['label'] ?? $label;
                    break;
                }
            }
        }
        $content = internal_facing_shortcode_series(array('product_type' => $product_type_key));
        internal_facing_render_full_page($label . ' | Product Type', $content);
    }
}
add_action('template_redirect', 'internal_facing_maybe_render_public_routes', 5);

function internal_facing_register_query_vars($vars) {
    $vars[] = 'internal_facing_product_id';
    $vars[] = 'internal_facing_series_id';
    $vars[] = 'internal_facing_product_type_key';
    $vars[] = 'internal_facing_product_slug';
    $vars[] = 'internal_facing_series_slug';
    return $vars;
}
add_filter('query_vars', 'internal_facing_register_query_vars');

function internal_facing_register_rewrite_rules() {
    add_rewrite_rule('^products/type/([^/]+)/?$', 'index.php?internal_facing_product_type_key=$matches[1]', 'top');
    add_rewrite_rule('^products/([0-9]+)/?$', 'index.php?internal_facing_product_id=$matches[1]', 'top');
    add_rewrite_rule('^series/([0-9]+)/?$', 'index.php?internal_facing_series_id=$matches[1]', 'top');
    add_rewrite_rule('^products/([^/]+)/?$', 'index.php?internal_facing_product_slug=$matches[1]', 'top');
    add_rewrite_rule('^series/([^/]+)/?$', 'index.php?internal_facing_series_slug=$matches[1]', 'top');
}
add_action('init', 'internal_facing_register_rewrite_rules');

function internal_facing_activate_plugin() {
    internal_facing_register_rewrite_rules();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'internal_facing_activate_plugin');

function internal_facing_deactivate_plugin() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'internal_facing_deactivate_plugin');

function internal_facing_enqueue_styles() {
    $css = '
      .internal-facing-page-shell{padding:2rem 1rem}
      .internal-facing-page-shell__inner{max-width:1180px;margin:0 auto}
      .internal-facing-type-nav{display:flex;flex-wrap:wrap;gap:.75rem;margin:0 0 1rem}
      .internal-facing-type-nav a{display:inline-flex;align-items:center;padding:.6rem .95rem;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#0f172a;text-decoration:none;font-weight:600}
      .internal-facing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}
      .internal-facing-card{border:1px solid #d7dde8;border-radius:10px;padding:1rem;background:#fff}
      .internal-facing-card__image{display:block;width:100%;height:auto;border-radius:8px;margin:0 0 1rem}
      .internal-facing-card__title{margin:0 0 .75rem;font-size:1.1rem}
      .internal-facing-card__type{margin:0 0 .75rem;color:#475569;font-weight:600;text-transform:uppercase;font-size:.78rem;letter-spacing:.06em}
      .internal-facing-card__series{margin:-.35rem 0 .85rem;color:#64748b;font-weight:600;font-size:.82rem}
      .internal-facing-card__meta{display:grid;gap:.5rem;margin:0}
      .internal-facing-card__meta div{display:grid;gap:.15rem}
      .internal-facing-card__meta dt{font-weight:600}
      .internal-facing-card__meta dd{margin:0}
      .internal-facing-card__actions{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0 0}
      .internal-facing-card__section{padding-top:1rem;border-top:1px solid #e2e8f0;margin-top:1rem}
      .internal-facing-card__section-title{margin:0 0 .5rem;font-size:1rem}
      .internal-facing-card__richtext > :first-child{margin-top:0}
      .internal-facing-card__richtext > :last-child{margin-bottom:0}
      .internal-facing-card__specs{display:grid;gap:.5rem;margin:0}
      .internal-facing-card__specs div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.75rem}
      .internal-facing-card__specs dt{font-weight:600}
      .internal-facing-card__specs dd{margin:0}
      .internal-facing-graph-preview{border:1px solid #d7dde8;border-radius:10px;overflow:hidden;background:#f8fafc;padding:.75rem}
      .internal-facing-graph-preview img{display:block;width:100%;height:auto;border-radius:8px;background:#fff}
      .internal-facing-pdf-preview{border:1px solid #d7dde8;border-radius:10px;overflow:hidden;background:#f8fafc}
      .internal-facing-pdf-preview iframe{display:block;width:100%;min-height:900px;border:0;background:#fff}
      .internal-facing-picker{display:grid;gap:1rem;padding:1rem;border:1px solid #d7dde8;border-radius:12px;background:#fff}
      .internal-facing-picker__grid,.internal-facing-picker__spec-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
      .internal-facing-picker label{display:block;margin:0 0 .35rem;font-weight:600}
      .internal-facing-picker select,.internal-facing-picker input{width:100%;padding:.6rem .7rem;border:1px solid #cbd5e1;border-radius:8px}
      .internal-facing-picker__range-inputs{display:grid;gap:.5rem;grid-template-columns:1fr 1fr}
      .internal-facing-picker__actions{display:flex;gap:.75rem}
      .internal-facing-picker__actions button{padding:.7rem 1rem;border:0;border-radius:8px;background:#0f62fe;color:#fff;font-weight:600;cursor:pointer}
      .internal-facing-picker__results{margin-top:1rem}
      .internal-facing-error{padding:.75rem 1rem;border-radius:8px;background:#fee2e2;color:#991b1b}
      .internal-facing-empty-state{padding:1rem 1.1rem;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;color:#334155}
    ';

    wp_register_style('internal-facing-api', false);
    wp_enqueue_style('internal-facing-api');
    wp_add_inline_style('internal-facing-api', $css);
}
add_action('wp_enqueue_scripts', 'internal_facing_enqueue_styles');

add_shortcode('internal_facing_products', 'internal_facing_shortcode_products');
add_shortcode('internal_facing_product', 'internal_facing_shortcode_product');
add_shortcode('internal_facing_series', 'internal_facing_shortcode_series');
add_shortcode('internal_facing_product_types_nav', 'internal_facing_shortcode_product_types_nav');
add_shortcode('internal_facing_product_picker', 'internal_facing_shortcode_product_picker');

add_shortcode('fan_graphs_fans', 'internal_facing_shortcode_products');
add_shortcode('fan_graphs_fan', 'internal_facing_shortcode_product');
