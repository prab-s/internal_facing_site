<?php
/**
 * Plugin Name: Internal Facing API
 * Description: Elementor-friendly shortcodes for customer-facing product content sourced from the Internal Facing FastAPI CMS endpoints.
 * Version: 0.1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function fan_graphs_api_base_url() {
    if (defined('FAN_GRAPHS_INTERNAL_API_BASE_URL')) {
        return rtrim(FAN_GRAPHS_INTERNAL_API_BASE_URL, '/');
    }
    return '';
}

function fan_graphs_api_token() {
    if (defined('FAN_GRAPHS_API_TOKEN')) {
        return FAN_GRAPHS_API_TOKEN;
    }
    return '';
}

function fan_graphs_resolve_media_url($path) {
    $path = trim((string) $path);
    if ($path === '') {
        return '';
    }

    if (preg_match('#^/api/cms/media/(product_images|product_graphs)/([^?]+)(\\?.*)?$#', $path, $matches)) {
        $kind = $matches[1];
        $file_name = $matches[2];
        $query_args = array(
            'fan_graphs_media' => $kind . '/' . $file_name,
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

    $base_url = fan_graphs_api_base_url();
    if ($base_url === '') {
        return $path;
    }

    if ($path[0] !== '/') {
        $path = '/' . $path;
    }

    return $base_url . $path;
}

function fan_graphs_maybe_proxy_media() {
    $media = isset($_GET['fan_graphs_media']) ? wp_unslash($_GET['fan_graphs_media']) : '';
    if ($media === '') {
        return;
    }

    $media = trim((string) $media, '/');
    if (!preg_match('#^(product_images|product_graphs)/([^/]+)$#', $media, $matches)) {
        status_header(404);
        exit;
    }

    $kind = $matches[1];
    $file_name = sanitize_file_name($matches[2]);
    if ($file_name === '') {
        status_header(404);
        exit;
    }

    $url = fan_graphs_api_base_url() . '/api/cms/media/' . rawurlencode($kind) . '/' . rawurlencode($file_name);
    $query_params = $_GET;
    unset($query_params['fan_graphs_media']);
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
add_action('template_redirect', 'fan_graphs_maybe_proxy_media', 0);

function fan_graphs_api_request($path, $query = array()) {
    $base_url = fan_graphs_api_base_url();
    $token = fan_graphs_api_token();

    if (!$base_url || !$token) {
        return new WP_Error('fan_graphs_config', 'Internal Facing API is not configured.');
    }

    $url = $base_url . $path;
    if (!empty($query)) {
        $url = add_query_arg($query, $url);
    }

    $response = wp_remote_get($url, array(
        'timeout' => 15,
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
        return new WP_Error('fan_graphs_api', 'Internal Facing API request failed: ' . $status_code);
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        return new WP_Error('fan_graphs_json', 'Internal Facing API returned invalid JSON.');
    }

    return $decoded;
}

function fan_graphs_parse_parameter_filter_shortcut($raw_filters, $mode) {
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

function fan_graphs_build_parameter_filters_query($atts) {
    $raw_json = trim((string) ($atts['parameter_filters'] ?? ''));
    if ($raw_json !== '') {
        return $raw_json;
    }

    $filters = array_merge(
        fan_graphs_parse_parameter_filter_shortcut($atts['parameter_string_filters'] ?? '', 'string'),
        fan_graphs_parse_parameter_filter_shortcut($atts['parameter_number_filters'] ?? '', 'number')
    );

    return !empty($filters) ? wp_json_encode($filters) : '';
}

function fan_graphs_render_rich_section($title, $html) {
    if (!$html) {
        return '';
    }

    ob_start();
    ?>
    <section class="fan-graphs-card__section">
      <h4 class="fan-graphs-card__section-title"><?php echo esc_html($title); ?></h4>
      <div class="fan-graphs-card__richtext"><?php echo wp_kses_post($html); ?></div>
    </section>
    <?php
    return ob_get_clean();
}

function fan_graphs_render_parameter_groups($fan) {
    $groups = $fan['parameter_groups'] ?? array();
    if (!is_array($groups) || empty($groups)) {
        return '';
    }

    ob_start();
    ?>
    <div class="fan-graphs-card__sections">
      <?php foreach ($groups as $group) : ?>
        <section class="fan-graphs-card__section">
          <h4 class="fan-graphs-card__section-title"><?php echo esc_html($group['group_name'] ?? 'Specifications'); ?></h4>
          <dl class="fan-graphs-card__specs">
            <?php foreach (($group['parameters'] ?? array()) as $parameter) : ?>
              <?php
                $name = esc_html($parameter['parameter_name'] ?? '');
                $value_string = isset($parameter['value_string']) ? trim((string) $parameter['value_string']) : '';
                $value_number = $parameter['value_number'] ?? null;
                $unit = isset($parameter['unit']) ? trim((string) $parameter['unit']) : '';
                if ($name === '') {
                    continue;
                }
                if ($value_string !== '') {
                    $value = esc_html($value_string);
                } elseif ($value_number !== null && $value_number !== '') {
                    $value = esc_html((string) $value_number . ($unit !== '' ? ' ' . $unit : ''));
                } else {
                    $value = '—';
                }
              ?>
              <div>
                <dt><?php echo $name; ?></dt>
                <dd><?php echo $value; ?></dd>
              </div>
            <?php endforeach; ?>
          </dl>
        </section>
      <?php endforeach; ?>
    </div>
    <?php
    return ob_get_clean();
}

function fan_graphs_render_card($fan, $detailed = false) {
    $model = esc_html($fan['model'] ?? '');
    $product_type = esc_html($fan['product_type_label'] ?? $fan['product_type_key'] ?? '');
    $mounting_style = esc_html($fan['mounting_style'] ?? '');
    $discharge_type = esc_html($fan['discharge_type'] ?? '');
    $graph_image_url = esc_url(fan_graphs_resolve_media_url($fan['graph_image_url'] ?? ''));
    $primary_product_image_url = esc_url(fan_graphs_resolve_media_url($fan['primary_product_image_url'] ?? ''));

    ob_start();
    ?>
    <article class="fan-graphs-card">
      <?php if ($primary_product_image_url !== '') : ?>
        <img class="fan-graphs-card__image" src="<?php echo $primary_product_image_url; ?>" alt="<?php echo $model; ?>" />
      <?php endif; ?>
      <h3 class="fan-graphs-card__title"><?php echo $model; ?></h3>
      <?php if ($product_type !== '') : ?>
        <p class="fan-graphs-card__type"><?php echo $product_type; ?></p>
      <?php endif; ?>
      <dl class="fan-graphs-card__meta">
        <?php if ($mounting_style !== '') : ?>
          <div><dt>Mounting</dt><dd><?php echo $mounting_style; ?></dd></div>
        <?php endif; ?>
        <?php if ($discharge_type !== '') : ?>
          <div><dt>Discharge</dt><dd><?php echo $discharge_type; ?></dd></div>
        <?php endif; ?>
      </dl>
      <?php if ($graph_image_url !== '') : ?>
        <p class="fan-graphs-card__graph"><a href="<?php echo $graph_image_url; ?>">Download graph</a></p>
      <?php endif; ?>
      <?php if ($detailed) : ?>
        <?php echo fan_graphs_render_rich_section('Description', $fan['description_html'] ?? ''); ?>
        <?php echo fan_graphs_render_rich_section('Features', $fan['features_html'] ?? ''); ?>
        <?php echo fan_graphs_render_rich_section('Specifications', $fan['specifications_html'] ?? ''); ?>
        <?php echo fan_graphs_render_parameter_groups($fan); ?>
        <?php echo fan_graphs_render_rich_section('Comments', $fan['comments_html'] ?? ''); ?>
      <?php endif; ?>
    </article>
    <?php
    return ob_get_clean();
}

function fan_graphs_shortcode_list($atts) {
    $atts = shortcode_atts(array(
        'limit' => 12,
        'search' => '',
        'product_type' => '',
        'parameter_filters' => '',
        'parameter_string_filters' => '',
        'parameter_number_filters' => '',
    ), $atts, 'fan_graphs_fans');

    $parameter_filters = fan_graphs_build_parameter_filters_query($atts);

    $result = fan_graphs_api_request('/api/cms/products', array(
        'search' => $atts['search'],
        'product_type_key' => $atts['product_type'],
        'parameter_filters' => $parameter_filters,
    ));

    if (is_wp_error($result)) {
        return '<div class="fan-graphs-error">' . esc_html($result->get_error_message()) . '</div>';
    }

    $fans = array_slice($result, 0, intval($atts['limit']));

    ob_start();
    ?>
    <div class="fan-graphs-grid">
      <?php foreach ($fans as $fan) : ?>
        <?php echo fan_graphs_render_card($fan, false); ?>
      <?php endforeach; ?>
    </div>
    <?php
    return ob_get_clean();
}

function fan_graphs_shortcode_single($atts) {
    $atts = shortcode_atts(array(
        'id' => '',
    ), $atts, 'fan_graphs_fan');

    if ($atts['id'] === '') {
        return '<div class="fan-graphs-error">Missing product id.</div>';
    }

    $result = fan_graphs_api_request('/api/cms/products/' . intval($atts['id']));
    if (is_wp_error($result)) {
        return '<div class="fan-graphs-error">' . esc_html($result->get_error_message()) . '</div>';
    }

    return fan_graphs_render_card($result, true);
}

function fan_graphs_enqueue_styles() {
    $css = '
      .fan-graphs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}
      .fan-graphs-card{border:1px solid #d7dde8;border-radius:10px;padding:1rem;background:#fff}
      .fan-graphs-card__image{display:block;width:100%;height:auto;border-radius:8px;margin:0 0 1rem}
      .fan-graphs-card__title{margin:0 0 .75rem;font-size:1.1rem}
      .fan-graphs-card__type{margin:0 0 .75rem;color:#475569;font-weight:600;text-transform:uppercase;font-size:.78rem;letter-spacing:.06em}
      .fan-graphs-card__meta{display:grid;gap:.5rem;margin:0}
      .fan-graphs-card__meta div{display:grid;gap:.15rem}
      .fan-graphs-card__meta dt{font-weight:600}
      .fan-graphs-card__meta dd{margin:0}
      .fan-graphs-card__graph{margin:1rem 0 0}
      .fan-graphs-card__sections{display:grid;gap:1rem;margin-top:1rem}
      .fan-graphs-card__section{padding-top:1rem;border-top:1px solid #e2e8f0}
      .fan-graphs-card__section-title{margin:0 0 .5rem;font-size:1rem}
      .fan-graphs-card__richtext > :first-child{margin-top:0}
      .fan-graphs-card__richtext > :last-child{margin-bottom:0}
      .fan-graphs-card__specs{display:grid;gap:.5rem;margin:0}
      .fan-graphs-card__specs div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.75rem}
      .fan-graphs-card__specs dt{font-weight:600}
      .fan-graphs-card__specs dd{margin:0}
      .fan-graphs-error{padding:.75rem 1rem;border-radius:8px;background:#fee2e2;color:#991b1b}
    ';

    wp_register_style('fan-graphs-api', false);
    wp_enqueue_style('fan-graphs-api');
    wp_add_inline_style('fan-graphs-api', $css);
}

add_shortcode('fan_graphs_fans', 'fan_graphs_shortcode_list');
add_shortcode('fan_graphs_fan', 'fan_graphs_shortcode_single');
add_action('wp_enqueue_scripts', 'fan_graphs_enqueue_styles');
