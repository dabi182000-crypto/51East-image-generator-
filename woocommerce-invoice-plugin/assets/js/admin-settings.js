(function ($) {
    'use strict';

    $(function () {
        var frame;

        $(document).on('click', '.fe-upload-logo-btn', function (e) {
            e.preventDefault();

            var $input = $('#51east_invoice_logo_url');
            var $preview = $('.fe-logo-preview');

            if (frame) {
                frame.open();
                return;
            }

            frame = wp.media({
                title: 'Select or Upload Logo',
                button: { text: 'Use as Logo' },
                multiple: false,
                library: { type: 'image' }
            });

            frame.on('select', function () {
                var attachment = frame.state().get('selection').first().toJSON();
                $input.val(attachment.url);
                $preview.html(
                    '<img src="' + attachment.url + '" style="max-width:200px;max-height:90px;display:block;border:1px solid #ddd;padding:4px;background:#fff;">'
                );
            });

            frame.open();
        });

        $(document).on('click', '.fe-remove-logo-btn', function (e) {
            e.preventDefault();
            $('#51east_invoice_logo_url').val('');
            $('.fe-logo-preview').empty();
        });
    });
})(jQuery);
