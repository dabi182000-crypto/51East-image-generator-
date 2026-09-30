# 51East Invoice Generator for WooCommerce

Generate professional bilingual (Arabic/English) invoices for WooCommerce orders.

## Features

- **Bilingual invoices** — download in English or Arabic with full RTL support
- **Company branding** — logo, company name, address, phone, email, tax number
- **Complete order details** — line items with SKU, quantities, unit prices
- **Shipping info** — shipping address and method
- **Tax & discount** — tax breakdown, discounts, fees
- **Customer info** — billing and shipping addresses, phone, email
- **Admin order page** — download buttons on each order
- **Orders list** — quick action buttons for both languages
- **Customer-facing** — download links on My Account → Orders and order detail pages
- **PDF support** — optional PDF output via Dompdf library
- **Preview mode** — preview invoices in browser before downloading

## Installation

1. Download or clone this folder (`woocommerce-invoice-plugin`)
2. Rename it to `51east-invoice` 
3. Upload to `wp-content/plugins/` on your WordPress site
4. Activate the plugin from **Plugins** in WordPress admin
5. Go to **WooCommerce → Settings → Invoice** to configure

## Configuration

Under **WooCommerce → Settings → Invoice**:

| Setting | Description |
|---------|-------------|
| Company Name (EN/AR) | Your company name in both languages |
| Address (EN/AR) | Full address in both languages |
| Phone / Email | Contact details shown on invoices |
| Tax Registration # | Your tax/VAT registration number |
| Invoice Prefix | e.g. `INV-` generates `INV-00001` |
| Footer Note (EN/AR) | Thank you message at bottom |
| Currency Label (EN/AR) | Custom currency display (e.g. د.إ) |

### Logo Upload

Upload your logo via **Media → Add New**, then paste the URL into a custom field, 
or use the built-in upload on the settings page.

## PDF Output (Optional)

For PDF download instead of HTML, install Dompdf:

```bash
cd wp-content/plugins/51east-invoice
composer require dompdf/dompdf
```

Without Dompdf, invoices open as styled HTML pages that you can print to PDF from the browser (Ctrl+P / Cmd+P → Save as PDF).

## How It Works

### Admin Side
- **Order edit page**: A meta box on the right shows download buttons for both languages + preview links
- **Orders list**: Quick action icons appear on each order row

### Customer Side
- **My Account → Orders**: "Invoice EN" and "Invoice AR" action buttons
- **Order detail page**: Download buttons below the order table

## Requirements

- WordPress 5.0+
- WooCommerce 5.0+
- PHP 7.4+
