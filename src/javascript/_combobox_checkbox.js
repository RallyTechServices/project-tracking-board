var comboTPL = new Ext.XTemplate(
         '<tpl for=".">',
             '<div class="x-boundlist-item">',
                          '<tpl if="values.Name">',
                 '{name} ( ',
                 '<input type="checkbox" checked="checked" disabled="disabled" />',
                 ' )',
             '</tpl>',
              '<tpl if="!values.Name">',
                 '{name} ( ',
                 '<input type="checkbox" disabled="disabled" />',
                 ' )',
             '</tpl>',
           '</div>',
         '</tpl>' // end for
     );