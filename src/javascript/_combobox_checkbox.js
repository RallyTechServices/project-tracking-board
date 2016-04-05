var comboTPL = new Ext.XTemplate(
         '<tpl for=".">',
             '<div class="x-combo-list-item"><img src="" class="chkCombo-default-icon chkCombo" /> { name }</div>',
         '</tpl>' // end for
     );

/*

<div class="x-combo-list-item"><img src="" class="chkCombo-default-icon chkCombo" /> {'+ displayField +'}</div>
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
*/