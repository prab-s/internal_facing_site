<?php
/**
 * Plugin Name: Fan Graphs API
 * Description: Elementor-friendly shortcodes for customer-facing fan content sourced from the Fan Graphs FastAPI CMS endpoints.
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

function fan_graphs_api_request($path, $query = array()) {
    $base_url = fan_graphs_api_base_url();
    $token = fan_graphs_api_token();

    if (!$base_url || !$token) {
        return new WP_Error('fan_graphs_config', 'Fan Graphs API is not configured.');
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
        return new WP_Error('fan_graphs_api', 'Fan Graphs API request failed: ' . $status_code);
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        return new WP_Error('fan_graphs_json', 'Fan Graphs API returned invalid JSON.');
    }

    return $decoded;
}

function fan_graphs_render_card($fan, $show_notes = false) {
    $manufacturer = esc_html($fan['manufacturer'] ?? '');
    $model = esc_html($fan['model'] ?? '');
    $mounting_style = esc_html($fan['mounting_style'] ?? '');
    $discharge_type = esc_html($fan['discharge_type'] ?? '');
    $diameter_mm = isset($fan['diameter_mm']) && $fan['diameter_mm'] !== null ? esc_html($fan['diameter_mm']) : '';
    $max_rpm = isset($fan['max_rpm']) && $fan['max_rpm'] !== null ? esc_html($fan['max_rpm']) : '';
    $notes = esc_html($fan['notes'] ?? '');

    ob_start();
    ?>
    <article class="fan-graphs-card">
      <h3 class="fan-graphs-card__title"><?php echo $manufacturer; ?> <?php echo $model; ?></h3>
      <dl class="fan-graphs-card__meta">
        <?php if ($mounting_style !== '') : ?>
          <div><dt>Mounting</dt><dd><?php echo $mounting_style; ?></dd></div>
        <?php endif; ?>
        <?php if ($discharge_type !== '') : ?>
          <div><dt>Discharge</dt><dd><?php echo $discharge_type; ?></dd></div>
        <?php endif; ?>
        <?php if ($diameter_mm !== '') : ?>
          <div><dt>Diameter</dt><dd><?php echo $diameter_mm; ?> mm</dd></div>
        <?php endif; ?>
        <?php if ($max_rpm !== '') : ?>
          <div><dt>Max RPM</dt><dd><?php echo $max_rpm; ?></dd></div>
        <?php endif; ?>
      </dl>
      <?php if ($show_notes && $notes !== '') : ?>
        <p class="fan-graphs-card__notes"><?php echo $notes; ?></p>
      <?php endif; ?>
    </article>
    <?php
    return ob_get_clean();
}

function fan_graphs_shortcode_list($atts) {
    $atts = shortcode_atts(array(
        'limit' => 12,
        'manufacturer' => '',
        'search' => '',
        'show_notes' => 'false',
    ), $atts, 'fan_graphs_fans');

    $result = fan_graphs_api_request('/api/cms/fans', array(
        'manufacturer' => $atts['manufacturer'],
        'search' => $atts['search'],
    ));

    if (is_wp_error($result)) {
        return '<div class="fan-graphs-error">' . esc_html($result->get_error_message()) . '</div>';
    }

    $show_notes = strtolower($atts['show_notes']) === 'true';
    $fans = array_slice($result, 0, intval($atts['limit']));

    ob_start();
    ?>
    <div class="fan-graphs-grid">
      <?php foreach ($fans as $fan) : ?>
        <?php echo fan_graphs_render_card($fan, $show_notes); ?>
      <?php endforeach; ?>
    </div>
    <?php
    return ob_get_clean();
}

function fan_graphs_shortcode_single($atts) {
    $atts = shortcode_atts(array(
        'id' => '',
        'show_notes' => 'true',
    ), $atts, 'fan_graphs_fan');

    if ($atts['id'] === '') {
        return '<div class="fan-graphs-error">Missing fan id.</div>';
    }

    $result = fan_graphs_api_request('/api/cms/fans/' . intval($atts['id']));
    if (is_wp_error($result)) {
        return '<div class="fan-graphs-error">' . esc_html($result->get_error_message()) . '</div>';
    }

    $show_notes = strtolower($atts['show_notes']) === 'true';
    return fan_graphs_render_card($result, $show_notes);
}

function fan_graphs_enqueue_styles() {
    $css = '
      .fan-graphs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}
      .fan-graphs-card{border:1px solid #d7dde8;border-radius:10px;padding:1rem;background:#fff}
      .fan-graphs-card__title{margin:0 0 .75rem;font-size:1.1rem}
      .fan-graphs-card__meta{display:grid;gap:.5rem;margin:0}
      .fan-graphs-card__meta div{display:grid;gap:.15rem}
      .fan-graphs-card__meta dt{font-weight:600}
      .fan-graphs-card__meta dd{margin:0}
      .fan-graphs-card__notes{margin:.9rem 0 0}
      .fan-graphs-error{padding:.75rem 1rem;border-radius:8px;background:#fee2e2;color:#991b1b}
    ';

    wp_register_style('fan-graphs-api', false);
    wp_enqueue_style('fan-graphs-api');
    wp_add_inline_style('fan-graphs-api', $css);
}

add_shortcode('fan_graphs_fans', 'fan_graphs_shortcode_list');
add_shortcode('fan_graphs_fan', 'fan_graphs_shortcode_single');
add_action('wp_enqueue_scripts', 'fan_graphs_enqueue_styles');
