<?php
defined('ABSPATH') || exit;

class FiftyOneEast_Invoice_Generator {

    private $order;
    private $lang;
    private $labels;

    private static $labels_map = [
        'en' => [
            'invoice'          => 'INVOICE',
            'invoice_number'   => 'Invoice #',
            'date'             => 'Date',
            'order_number'     => 'Order #',
            'payment_method'   => 'Payment Method',
            'bill_to'          => 'Bill To',
            'ship_to'          => 'Ship To',
            'item'             => 'Item',
            'sku'              => 'SKU',
            'qty'              => 'Qty',
            'unit_price'       => 'Unit Price',
            'total'            => 'Total',
            'subtotal'         => 'Subtotal',
            'shipping'         => 'Shipping',
            'shipping_method'  => 'Shipping Method',
            'discount'         => 'Discount',
            'tax'              => 'Tax',
            'grand_total'      => 'Grand Total',
            'phone'            => 'Phone',
            'email'            => 'Email',
            'tax_number'       => 'Tax Reg. #',
            'notes'            => 'Notes',
            'page'             => 'Page',
        ],
        'ar' => [
            'invoice'          => 'فاتورة',
            'invoice_number'   => 'رقم الفاتورة',
            'date'             => 'التاريخ',
            'order_number'     => 'رقم الطلب',
            'payment_method'   => 'طريقة الدفع',
            'bill_to'          => 'فاتورة إلى',
            'ship_to'          => 'الشحن إلى',
            'item'             => 'المنتج',
            'sku'              => 'رمز المنتج',
            'qty'              => 'الكمية',
            'unit_price'       => 'سعر الوحدة',
            'total'            => 'المجموع',
            'subtotal'         => 'المجموع الفرعي',
            'shipping'         => 'الشحن',
            'shipping_method'  => 'طريقة الشحن',
            'discount'         => 'الخصم',
            'tax'              => 'الضريبة',
            'grand_total'      => 'المجموع الكلي',
            'phone'            => 'الهاتف',
            'email'            => 'البريد الإلكتروني',
            'tax_number'       => 'الرقم الضريبي',
            'notes'            => 'ملاحظات',
            'page'             => 'صفحة',
        ],
    ];

    public function __construct($order_id, $lang = 'en') {
        $this->order = wc_get_order($order_id);
        $this->lang = in_array($lang, ['en', 'ar'], true) ? $lang : 'en';
        $this->labels = self::$labels_map[$this->lang];
    }

    public function get_html() {
        if (!$this->order) {
            return '';
        }

        $is_rtl = ($this->lang === 'ar');
        $dir = $is_rtl ? 'rtl' : 'ltr';
        $font_family = $is_rtl
            ? "'Noto Naskh Arabic', 'Tahoma', 'Arial', sans-serif"
            : "'Helvetica Neue', 'Arial', sans-serif";

        $settings = [
            'company_name' => FiftyOneEast_Invoice_Settings::get('company_name_' . $this->lang),
            'address'      => FiftyOneEast_Invoice_Settings::get('address_' . $this->lang),
            'phone'        => FiftyOneEast_Invoice_Settings::get('phone'),
            'email'        => FiftyOneEast_Invoice_Settings::get('email'),
            'tax_number'   => FiftyOneEast_Invoice_Settings::get('tax_number'),
            'logo_url'     => FiftyOneEast_Invoice_Settings::get_logo_url(),
            'prefix'       => FiftyOneEast_Invoice_Settings::get('prefix', 'INV-'),
            'footer'       => FiftyOneEast_Invoice_Settings::get('footer_' . $this->lang),
            'currency'     => FiftyOneEast_Invoice_Settings::get('currency_' . $this->lang),
            'accent_color' => FiftyOneEast_Invoice_Settings::get('accent_color', '#2c3e50'),
        ];

        $order = $this->order;
        $invoice_number = $settings['prefix'] . str_pad($order->get_id(), 5, '0', STR_PAD_LEFT);
        $currency_symbol = !empty($settings['currency']) ? $settings['currency'] : $order->get_currency();
        $accent = $settings['accent_color'];

        ob_start();
        ?>
<!DOCTYPE html>
<html lang="<?php echo $this->lang; ?>">
<head>
<meta charset="UTF-8">
<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: <?php echo $font_family; ?>;
        font-size: 13px;
        color: #1a1a1a;
        line-height: 1.6;
        background: #fff;
        direction: <?php echo $dir; ?>;
        text-align: <?php echo $is_rtl ? 'right' : 'left'; ?>;
    }

    .invoice-wrap {
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
    }

    /* ── Header ── */
    .header {
        display: table;
        width: 100%;
        margin-bottom: 28px;
        padding-bottom: 18px;
        border-bottom: 3px solid <?php echo $accent; ?>;
    }
    .header-company,
    .header-invoice {
        display: table-cell;
        width: 50%;
        vertical-align: top;
    }

    <?php if ($is_rtl) : ?>
    .header-company { text-align: left; }
    .header-invoice { text-align: right; }
    <?php else : ?>
    .header-company { text-align: left; }
    .header-invoice { text-align: right; }
    <?php endif; ?>

    .company-logo {
        max-width: 180px;
        max-height: 80px;
        object-fit: contain;
        margin-bottom: 10px;
    }
    .company-name {
        font-size: 20px;
        font-weight: 700;
        color: <?php echo $accent; ?>;
        margin-bottom: 4px;
    }
    .company-details {
        font-size: 12px;
        color: #555;
        white-space: pre-line;
    }
    .invoice-title {
        font-size: 32px;
        font-weight: 700;
        color: <?php echo $accent; ?>;
        letter-spacing: <?php echo $is_rtl ? '0' : '3px'; ?>;
        margin-bottom: 12px;
    }
    .invoice-meta {
        font-size: 13px;
        color: #444;
    }
    .invoice-meta div {
        margin-bottom: 3px;
    }
    .invoice-meta .label {
        font-weight: 700;
        color: #333;
    }

    /* ── Addresses ── */
    .addresses {
        display: table;
        width: 100%;
        margin-bottom: 28px;
    }
    .address-box {
        display: table-cell;
        width: 48%;
        background: #f8f9fa;
        border-radius: 6px;
        padding: 16px 20px;
        vertical-align: top;
    }
    .address-spacer {
        display: table-cell;
        width: 4%;
    }

    <?php if ($is_rtl) : ?>
    .address-box { border-right: 4px solid <?php echo $accent; ?>; text-align: right; }
    <?php else : ?>
    .address-box { border-left: 4px solid <?php echo $accent; ?>; text-align: left; }
    <?php endif; ?>

    .address-box h3 {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: <?php echo $accent; ?>;
        margin-bottom: 8px;
        font-weight: 700;
    }
    .address-box p {
        margin: 2px 0;
        color: #333;
        font-size: 13px;
    }

    /* ── Items table ── */
    .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
    }
    .items-table thead th {
        background: <?php echo $accent; ?>;
        color: #fff;
        padding: 10px 12px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
        text-align: <?php echo $is_rtl ? 'right' : 'left'; ?>;
    }
    .items-table thead th.col-num {
        text-align: center;
        width: 40px;
    }
    .items-table thead th.col-amount {
        text-align: <?php echo $is_rtl ? 'left' : 'right'; ?>;
    }
    .items-table tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid #e9ecef;
        vertical-align: top;
        text-align: <?php echo $is_rtl ? 'right' : 'left'; ?>;
    }
    .items-table tbody td.col-num {
        text-align: center;
    }
    .items-table tbody td.col-amount {
        text-align: <?php echo $is_rtl ? 'left' : 'right'; ?>;
        white-space: nowrap;
    }
    .items-table tbody tr:nth-child(even) {
        background: #f8f9fa;
    }
    .item-name { font-weight: 600; }
    .item-meta { font-size: 11px; color: #777; margin-top: 2px; }

    /* ── Totals ── */
    .totals-section {
        margin-bottom: 28px;
    }
    .totals-table {
        width: 320px;
        border-collapse: collapse;
        <?php echo $is_rtl ? 'margin-left: 0; margin-right: auto;' : 'margin-left: auto; margin-right: 0;'; ?>
    }
    .totals-table td {
        padding: 8px 12px;
        border-bottom: 1px solid #e9ecef;
        font-size: 13px;
    }
    .totals-table .totals-label {
        text-align: <?php echo $is_rtl ? 'right' : 'left'; ?>;
        color: #555;
    }
    .totals-table .totals-value {
        text-align: <?php echo $is_rtl ? 'left' : 'right'; ?>;
        font-weight: 600;
    }
    .totals-table tr.grand-total td {
        background: <?php echo $accent; ?>;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        border: none;
    }

    /* ── Shipping info ── */
    .shipping-info {
        background: #f0f4f8;
        border-radius: 6px;
        padding: 14px 20px;
        margin-bottom: 24px;
        font-size: 13px;
        text-align: <?php echo $is_rtl ? 'right' : 'left'; ?>;
    }
    .shipping-info strong { color: <?php echo $accent; ?>; }

    /* ── Footer ── */
    .footer {
        border-top: 2px solid #e9ecef;
        padding-top: 16px;
        text-align: center;
        color: #888;
        font-size: 12px;
    }
    .footer .note {
        margin-bottom: 6px;
        font-style: italic;
        color: #555;
    }

    @media print {
        body { padding: 0; }
        .invoice-wrap { padding: 20px; }
    }
</style>
</head>
<body>
<div class="invoice-wrap">

    <!-- Header -->
    <div class="header">
        <?php if ($is_rtl) : ?>
        <!-- RTL: Company on LEFT (first in HTML), Invoice title on RIGHT (second in HTML) -->
        <div class="header-company">
            <?php if (!empty($settings['logo_url'])) : ?>
                <img src="<?php echo esc_url($settings['logo_url']); ?>" class="company-logo" alt="Logo">
            <?php endif; ?>
            <?php if (!empty($settings['company_name'])) : ?>
                <div class="company-name"><?php echo esc_html($settings['company_name']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['address'])) : ?>
                <div class="company-details"><?php echo esc_html($settings['address']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['phone'])) : ?>
                <div class="company-details"><?php echo esc_html($this->labels['phone']); ?>: <?php echo esc_html($settings['phone']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['email'])) : ?>
                <div class="company-details"><?php echo esc_html($this->labels['email']); ?>: <?php echo esc_html($settings['email']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['tax_number'])) : ?>
                <div class="company-details"><?php echo esc_html($this->labels['tax_number']); ?>: <?php echo esc_html($settings['tax_number']); ?></div>
            <?php endif; ?>
        </div>
        <div class="header-invoice">
            <div class="invoice-title"><?php echo esc_html($this->labels['invoice']); ?></div>
            <div class="invoice-meta">
                <div><span class="label"><?php echo esc_html($this->labels['invoice_number']); ?>:</span> <?php echo esc_html($invoice_number); ?></div>
                <div><span class="label"><?php echo esc_html($this->labels['date']); ?>:</span> <?php echo esc_html($order->get_date_created()->format('Y-m-d')); ?></div>
                <div><span class="label"><?php echo esc_html($this->labels['order_number']); ?>:</span> <?php echo esc_html($order->get_order_number()); ?></div>
                <div><span class="label"><?php echo esc_html($this->labels['payment_method']); ?>:</span> <?php echo esc_html($order->get_payment_method_title()); ?></div>
            </div>
        </div>
        <?php else : ?>
        <!-- LTR: Company on LEFT, invoice title on RIGHT -->
        <div class="header-company">
            <?php if (!empty($settings['logo_url'])) : ?>
                <img src="<?php echo esc_url($settings['logo_url']); ?>" class="company-logo" alt="Logo">
            <?php endif; ?>
            <?php if (!empty($settings['company_name'])) : ?>
                <div class="company-name"><?php echo esc_html($settings['company_name']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['address'])) : ?>
                <div class="company-details"><?php echo esc_html($settings['address']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['phone'])) : ?>
                <div class="company-details"><?php echo esc_html($this->labels['phone']); ?>: <?php echo esc_html($settings['phone']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['email'])) : ?>
                <div class="company-details"><?php echo esc_html($this->labels['email']); ?>: <?php echo esc_html($settings['email']); ?></div>
            <?php endif; ?>
            <?php if (!empty($settings['tax_number'])) : ?>
                <div class="company-details"><?php echo esc_html($this->labels['tax_number']); ?>: <?php echo esc_html($settings['tax_number']); ?></div>
            <?php endif; ?>
        </div>
        <div class="header-invoice">
            <div class="invoice-title"><?php echo esc_html($this->labels['invoice']); ?></div>
            <div class="invoice-meta">
                <div><span class="label"><?php echo esc_html($this->labels['invoice_number']); ?>:</span> <?php echo esc_html($invoice_number); ?></div>
                <div><span class="label"><?php echo esc_html($this->labels['date']); ?>:</span> <?php echo esc_html($order->get_date_created()->format('Y-m-d')); ?></div>
                <div><span class="label"><?php echo esc_html($this->labels['order_number']); ?>:</span> <?php echo esc_html($order->get_order_number()); ?></div>
                <div><span class="label"><?php echo esc_html($this->labels['payment_method']); ?>:</span> <?php echo esc_html($order->get_payment_method_title()); ?></div>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Billing & Shipping addresses -->
    <div class="addresses">
        <?php if ($is_rtl) : ?>
        <!-- RTL: Bill-to first (right side), then ship-to (left side) -->
        <div class="address-box">
            <h3><?php echo esc_html($this->labels['bill_to']); ?></h3>
            <?php $this->render_billing_address($order); ?>
        </div>
        <div class="address-spacer"></div>
        <?php if ($order->has_shipping_address()) : ?>
        <div class="address-box">
            <h3><?php echo esc_html($this->labels['ship_to']); ?></h3>
            <?php $this->render_shipping_address($order); ?>
        </div>
        <?php endif; ?>
        <?php else : ?>
        <!-- LTR: Bill-to on left, ship-to on right -->
        <div class="address-box">
            <h3><?php echo esc_html($this->labels['bill_to']); ?></h3>
            <?php $this->render_billing_address($order); ?>
        </div>
        <div class="address-spacer"></div>
        <?php if ($order->has_shipping_address()) : ?>
        <div class="address-box">
            <h3><?php echo esc_html($this->labels['ship_to']); ?></h3>
            <?php $this->render_shipping_address($order); ?>
        </div>
        <?php endif; ?>
        <?php endif; ?>
    </div>

    <!-- Items table -->
    <table class="items-table">
        <thead>
            <tr>
                <?php if ($is_rtl) : ?>
                <th class="col-amount"><?php echo esc_html($this->labels['total']); ?></th>
                <th class="col-amount"><?php echo esc_html($this->labels['unit_price']); ?></th>
                <th class="col-num"><?php echo esc_html($this->labels['qty']); ?></th>
                <th><?php echo esc_html($this->labels['sku']); ?></th>
                <th><?php echo esc_html($this->labels['item']); ?></th>
                <th class="col-num">#</th>
                <?php else : ?>
                <th class="col-num">#</th>
                <th><?php echo esc_html($this->labels['item']); ?></th>
                <th><?php echo esc_html($this->labels['sku']); ?></th>
                <th class="col-num"><?php echo esc_html($this->labels['qty']); ?></th>
                <th class="col-amount"><?php echo esc_html($this->labels['unit_price']); ?></th>
                <th class="col-amount"><?php echo esc_html($this->labels['total']); ?></th>
                <?php endif; ?>
            </tr>
        </thead>
        <tbody>
            <?php
            $i = 1;
            foreach ($order->get_items() as $item_id => $item) :
                $product = $item->get_product();
                $sku = $product ? $product->get_sku() : '';
                $qty = $item->get_quantity();
                $line_total = $item->get_total();
                $unit_price = $qty > 0 ? $line_total / $qty : 0;
                $meta_data = $item->get_formatted_meta_data('_', true);
            ?>
            <tr>
                <?php if ($is_rtl) : ?>
                <td class="col-amount"><?php echo esc_html(number_format($line_total, 2) . ' ' . $currency_symbol); ?></td>
                <td class="col-amount"><?php echo esc_html(number_format($unit_price, 2) . ' ' . $currency_symbol); ?></td>
                <td class="col-num"><?php echo esc_html($qty); ?></td>
                <td><?php echo esc_html($sku); ?></td>
                <td>
                    <div class="item-name"><?php echo esc_html($item->get_name()); ?></div>
                    <?php if (!empty($meta_data)) : ?>
                        <div class="item-meta">
                            <?php foreach ($meta_data as $meta) : ?>
                                <?php echo wp_kses_post($meta->display_key . ': ' . $meta->display_value); ?><br>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </td>
                <td class="col-num"><?php echo $i++; ?></td>
                <?php else : ?>
                <td class="col-num"><?php echo $i++; ?></td>
                <td>
                    <div class="item-name"><?php echo esc_html($item->get_name()); ?></div>
                    <?php if (!empty($meta_data)) : ?>
                        <div class="item-meta">
                            <?php foreach ($meta_data as $meta) : ?>
                                <?php echo wp_kses_post($meta->display_key . ': ' . $meta->display_value); ?><br>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </td>
                <td><?php echo esc_html($sku); ?></td>
                <td class="col-num"><?php echo esc_html($qty); ?></td>
                <td class="col-amount"><?php echo esc_html(number_format($unit_price, 2) . ' ' . $currency_symbol); ?></td>
                <td class="col-amount"><?php echo esc_html(number_format($line_total, 2) . ' ' . $currency_symbol); ?></td>
                <?php endif; ?>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <!-- Shipping Method -->
    <?php
    $shipping_methods = $order->get_shipping_methods();
    if (!empty($shipping_methods)) :
    ?>
    <div class="shipping-info">
        <strong><?php echo esc_html($this->labels['shipping_method']); ?>:</strong>
        <?php
        $methods = [];
        foreach ($shipping_methods as $method) {
            $methods[] = $method->get_name();
        }
        echo esc_html(implode(', ', $methods));
        ?>
    </div>
    <?php endif; ?>

    <!-- Totals -->
    <div class="totals-section">
        <table class="totals-table">
            <tr>
                <td class="totals-label"><?php echo esc_html($this->labels['subtotal']); ?></td>
                <td class="totals-value"><?php echo esc_html(number_format($order->get_subtotal(), 2) . ' ' . $currency_symbol); ?></td>
            </tr>
            <?php if ((float) $order->get_shipping_total() > 0) : ?>
            <tr>
                <td class="totals-label"><?php echo esc_html($this->labels['shipping']); ?></td>
                <td class="totals-value"><?php echo esc_html(number_format((float) $order->get_shipping_total(), 2) . ' ' . $currency_symbol); ?></td>
            </tr>
            <?php endif; ?>
            <?php if ((float) $order->get_total_discount() > 0) : ?>
            <tr>
                <td class="totals-label"><?php echo esc_html($this->labels['discount']); ?></td>
                <td class="totals-value">-<?php echo esc_html(number_format((float) $order->get_total_discount(), 2) . ' ' . $currency_symbol); ?></td>
            </tr>
            <?php endif; ?>
            <?php if ((float) $order->get_total_tax() > 0) : ?>
            <tr>
                <td class="totals-label"><?php echo esc_html($this->labels['tax']); ?></td>
                <td class="totals-value"><?php echo esc_html(number_format((float) $order->get_total_tax(), 2) . ' ' . $currency_symbol); ?></td>
            </tr>
            <?php endif; ?>
            <?php
            foreach ($order->get_fees() as $fee) :
                $fee_total = $fee->get_total();
            ?>
            <tr>
                <td class="totals-label"><?php echo esc_html($fee->get_name()); ?></td>
                <td class="totals-value"><?php echo esc_html(number_format((float) $fee_total, 2) . ' ' . $currency_symbol); ?></td>
            </tr>
            <?php endforeach; ?>
            <tr class="grand-total">
                <td class="totals-label"><?php echo esc_html($this->labels['grand_total']); ?></td>
                <td class="totals-value"><?php echo esc_html(number_format((float) $order->get_total(), 2) . ' ' . $currency_symbol); ?></td>
            </tr>
        </table>
    </div>

    <?php if ($order->get_customer_note()) : ?>
    <div class="shipping-info">
        <strong><?php echo esc_html($this->labels['notes']); ?>:</strong>
        <?php echo esc_html($order->get_customer_note()); ?>
    </div>
    <?php endif; ?>

    <!-- Footer -->
    <div class="footer">
        <?php if (!empty($settings['footer'])) : ?>
            <div class="note"><?php echo esc_html($settings['footer']); ?></div>
        <?php endif; ?>
        <div><?php echo esc_html($settings['company_name']); ?> &mdash; <?php echo esc_html($invoice_number); ?></div>
    </div>

</div>
</body>
</html>
        <?php
        return ob_get_clean();
    }

    private function render_billing_address($order) {
        ?>
        <p><strong><?php echo esc_html($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()); ?></strong></p>
        <?php if ($order->get_billing_company()) : ?>
            <p><?php echo esc_html($order->get_billing_company()); ?></p>
        <?php endif; ?>
        <p><?php echo esc_html($order->get_billing_address_1()); ?></p>
        <?php if ($order->get_billing_address_2()) : ?>
            <p><?php echo esc_html($order->get_billing_address_2()); ?></p>
        <?php endif; ?>
        <p><?php echo esc_html(implode(', ', array_filter([
            $order->get_billing_city(),
            $order->get_billing_state(),
            $order->get_billing_postcode(),
        ]))); ?></p>
        <p><?php echo esc_html(WC()->countries->countries[$order->get_billing_country()] ?? $order->get_billing_country()); ?></p>
        <?php if ($order->get_billing_phone()) : ?>
            <p><?php echo esc_html($this->labels['phone']); ?>: <?php echo esc_html($order->get_billing_phone()); ?></p>
        <?php endif; ?>
        <?php if ($order->get_billing_email()) : ?>
            <p><?php echo esc_html($this->labels['email']); ?>: <?php echo esc_html($order->get_billing_email()); ?></p>
        <?php endif; ?>
        <?php
    }

    private function render_shipping_address($order) {
        ?>
        <p><strong><?php echo esc_html($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name()); ?></strong></p>
        <?php if ($order->get_shipping_company()) : ?>
            <p><?php echo esc_html($order->get_shipping_company()); ?></p>
        <?php endif; ?>
        <p><?php echo esc_html($order->get_shipping_address_1()); ?></p>
        <?php if ($order->get_shipping_address_2()) : ?>
            <p><?php echo esc_html($order->get_shipping_address_2()); ?></p>
        <?php endif; ?>
        <p><?php echo esc_html(implode(', ', array_filter([
            $order->get_shipping_city(),
            $order->get_shipping_state(),
            $order->get_shipping_postcode(),
        ]))); ?></p>
        <p><?php echo esc_html(WC()->countries->countries[$order->get_shipping_country()] ?? $order->get_shipping_country()); ?></p>
        <?php if ($order->get_shipping_phone()) : ?>
            <p><?php echo esc_html($this->labels['phone']); ?>: <?php echo esc_html($order->get_shipping_phone()); ?></p>
        <?php endif; ?>
        <?php
    }

    public function stream_pdf() {
        $html = $this->get_html();
        $invoice_number = FiftyOneEast_Invoice_Settings::get('prefix', 'INV-') .
            str_pad($this->order->get_id(), 5, '0', STR_PAD_LEFT);

        $filename = sanitize_file_name($invoice_number . '-' . $this->lang . '.pdf');

        if (class_exists('Dompdf\\Dompdf')) {
            $dompdf = new \Dompdf\Dompdf([
                'isRemoteEnabled' => true,
                'defaultFont'     => 'DejaVu Sans',
                'isHtml5ParserEnabled' => true,
            ]);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            $dompdf->stream($filename, ['Attachment' => true]);
            exit;
        }

        header('Content-Type: text/html; charset=utf-8');
        header('Content-Disposition: inline; filename="' . $filename . '"');
        echo $html;
        exit;
    }
}
