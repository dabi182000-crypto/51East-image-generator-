<?php
/**
 * Plugin Name: 51East Invoice Generator
 * Description: Generate bilingual (Arabic/English) PDF invoices for WooCommerce orders.
 * Version: 1.0.0
 * Author: 51East
 * Requires Plugins: woocommerce
 * Text Domain: 51east-invoice
 * Domain Path: /languages
 */

defined('ABSPATH') || exit;

define('FIFTYONE_EAST_INVOICE_VERSION', '1.0.0');
define('FIFTYONE_EAST_INVOICE_PATH', plugin_dir_path(__FILE__));
define('FIFTYONE_EAST_INVOICE_URL', plugin_dir_url(__FILE__));

require_once FIFTYONE_EAST_INVOICE_PATH . 'includes/class-invoice-settings.php';
require_once FIFTYONE_EAST_INVOICE_PATH . 'includes/class-invoice-generator.php';
require_once FIFTYONE_EAST_INVOICE_PATH . 'includes/class-invoice-admin.php';

final class FiftyOneEast_Invoice {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('plugins_loaded', [$this, 'init']);
        register_activation_hook(__FILE__, [$this, 'activate']);
    }

    public function init() {
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', function () {
                echo '<div class="error"><p>' .
                    esc_html__('51East Invoice requires WooCommerce to be installed and active.', '51east-invoice') .
                    '</p></div>';
            });
            return;
        }

        FiftyOneEast_Invoice_Settings::instance();
        FiftyOneEast_Invoice_Admin::instance();
    }

    public function activate() {
        $upload_dir = wp_upload_dir();
        $invoice_dir = $upload_dir['basedir'] . '/51east-invoices';
        if (!file_exists($invoice_dir)) {
            wp_mkdir_p($invoice_dir);
            file_put_contents($invoice_dir . '/.htaccess', 'deny from all');
            file_put_contents($invoice_dir . '/index.php', '<?php // Silence is golden.');
        }
    }
}

FiftyOneEast_Invoice::instance();
