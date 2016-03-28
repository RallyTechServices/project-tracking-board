Ext.define("PTBoard", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box',layout:{type:'hbox'}},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "PTBoard"
    },
                        
    launch: function() {
        var me = this;
        me._addSelector();
    },
      
    _addSelector: function() {
        var selector_box = this.down('#selector_box');
            selector_box.removeAll();
            
            selector_box.add({
                xtype:'rallyreleasecombobox',
                fieldLabel: 'Release:',
                listeners: {
                    scope: this,
                    change: function(rcb) {
                        this._addProjectSelector(rcb);
                    }
                }
            });
    },

    /*

selector_box.add({
                xtype:'rallycombobox',
                stateful: true,
                stateId: this.getContext().getScopedStateId('portfolioItem-cb'),
                width: 200,
                fieldLabel: 'PortfolioItem:',
                labelAlign: 'right',
                context: this.getContext(),
                // typeAhead : true,
                // typeAheadDelay: 100,
    //            minChars: 1, 
                allowBlank: false,
                autoSelect: false,
                storeConfig: {
                    model: this.getSetting('portfolioItemField'),
                    autoLoad:true,
                    // ,
                    // filters: filters,
                    remoteFilter: true
                },
                listeners: {
                    scope: this,
                    change: function(cb) {
                        this._publishTimebox();
                        this._updateData(cb.getRecord());
                    }
                }
            });
    */

    _addProjectSelector: function(rcb) {
        var me = this;

        me.release = rcb;

        var project_name = me.getContext().get('project').Name;

        var filter = Ext.create('Rally.data.wsapi.Filter', {
             property: 'Releases.Name',
             operator: 'contains',
             value: rcb.rawValue
        });

        filters = [
             {property:'Parent.Name',  value: project_name},
             {property:'Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name}
        ]
 
        filter = Rally.data.wsapi.Filter.or(filters).and({property:'Children.Name', value:"" }).and(filter);
        
        var selector_box = this.down('#selector_box');
            // selector_box.add({
            //     xtype: 'rallymultiobjectpicker',
            //     autoExpand: true,
            //     modelType: 'Project'
            //     // ,
            //     // storeConfig: {
            //     //     autoLoad: true,
            //     //     filters: filter,
            //     //     remoteFilter: true
            //     // }             
            //  });

        var selector_box = this.down('#selector_box');
            selector_box.add({
                xtype:'rallycombobox',
                multiSelect: true,
                allowNoEntry:true,
                autoSelect: false,
                fieldLabel: 'Project:',
                labelAlign: 'right',
                noEntryText: '--All--',
                // noEntryValue: 'All',
                storeConfig: {
                    autoLoad: true,
                    model: 'Project',
                    filters: filter,
                    remoteFilter: true
                },
                //tpl:comboTPL,
                listeners: {
                    scope: this,
                    change: function(cb) {
                        console.log(cb)
                        if(cb.lastSelection[0].get('Name')==""){
                            this._getArtifacts(filter);
                        }else{
                            cb.lastSelection;
                            var project_filters = [];
                            Ext.Array.each(cb.lastSelection,function(project){
                                project_filters.push({property:'ObjectID',  value: project.get('ObjectID')});
                            });
                            this._getArtifacts(Rally.data.wsapi.Filter.or(project_filters));
                        }
                        
                    }
                }
            });
    },


    _getArtifacts: function(project_filter){
        var me = this;
        this.setLoading("Loading Projects...");
        //me.release = rcb;
        // var project_name = me.getContext().get('project').Name;

        // var filter = Ext.create('Rally.data.wsapi.Filter', {
        //      property: 'Releases.Name',
        //      operator: 'contains',
        //      value: rcb.rawValue
        // });

        // filters = [
        //      {property:'Parent.Name',  value: project_name},
        //      {property:'Parent.Parent.Name', value: project_name},
        //      {property:'Parent.Parent.Parent.Name', value: project_name},
        //      {property:'Parent.Parent.Parent.Parent.Name', value: project_name},
        //      {property:'Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
        //      {property:'Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
        //      {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
        //      {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
        //      {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name}
        // ]
 
        // filter = Rally.data.wsapi.Filter.or(filters).and({property:'Children.Name', value:"" }).and(filter);
 
        var model_name = 'Project',
            field_names = ['Name','State','TeamMembers','User','Results','QueryResult'];
        
        this._loadAStoreWithAPromise(model_name, field_names,project_filter).then({
            scope: this,
            success: function(store) {
                this._displayGrid(store,field_names);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });

    },

    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Project',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromiseModel: function(model_name, model_fields,filter){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
        console.log('rcb filters>>',filter.toString());
 
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filter
        }).load({
            callback : function(records, operation, successful) {
                if (successful && records.length > 0){
                    deferred.resolve(records);
                } else {
                    me.logger.log("No Projects Found", operation);
                    deferred.reject("No Projects Found!");
                }
            }
        });
        return deferred.promise;
    },

  _loadAStoreWithAPromise: function(model_name, model_fields,filter){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        //me.logger.log("Starting load:",model_name,model_fields);
        // me.setLoading('Loading All Uesrs');
        Deft.Promise.all(me._loadAStoreWithAPromiseModel(model_name, model_fields,filter)).then({
            success: function(records){
                    //console.log('total users -yay',records)
                    if (records){
                        var promises = [];
                        var totalProjects = records.length,
                        me = this;
                        _.each(records, function(result){
                            promises.push(function(){
                                return me._getColleciton(result); 
                            });
                        },me);


                        Deft.Chain.sequence(promises).then({
                            success: function(results){
                                console.log('All permissions >>',results,results.length);
                                var projects = [];

                                for (var i = 0; records && i < records.length; i++) {
                                        var project = {
                                            ProjectName: records[i].get('Name'),
                                           // TCCounts: results[i].TCCounts,
                                            POorSMNames:results[i].POorSMNames,
                                            TotalTestCases:results[i].TCCounts.TotalTestCases,
                                            TotalExecuted:results[i].TCCounts.TotalTCExecuted.TotalExecuted,
                                            TotalAttachments:results[i].TCCounts.TotalAttachments,
                                            PassedTestCases:results[i].TCCounts.PassedTestCases,
                                            UATTCCounts:results[i].TCCounts.UATTCCounts,
                                            TotalUATExecuted:results[i].TCCounts.TotalTCExecuted.TotalUATExecuted,
                                            UATTCPassCounts:results[i].TCCounts.UATTCPassCounts,
                                            TotalDefects:results[i].TCCounts.TotalDefects,
                                            USAcceptedByPO:results[i].TCCounts.USAcceptedByPO,
                                            USAcceptedBySM:results[i].TCCounts.USAcceptedBySM,
                                            UserStoryCount:results[i].TCCounts.UserStoryCount
                                        }
                                        projects.push(project);
                                }
                                console.log('Projects >>',projects);
                                // create custom store (call function ) combine permissions and results in to one.
                                var store = Ext.create('Rally.data.custom.Store', {
                                    data: projects,
                                    scope: this
                                });
                                deferred.resolve(store);                        
                            }
                        });
                    } else {
                        deferred.reject('Problem loading: ');
                    }
                },
                failure: function(error_message){
                    // console.log('error_message>>',error_message)
                    // alert(error_message);
                    deferred.reject(error_message);

                },
                scope: me
            });
            return deferred.promise;
           
    },

    _getColleciton: function(record){
        me = this;
        var deferred = Ext.create('Deft.Deferred');

         var users = [];
         var sm_oids = [];
         var po_oids = [];

        record.getCollection('TeamMembers').load({
            fetch: ['ObjectID', 'FirstName', 'LastName','Role'],
            callback: function(records, operation, success) {
                Ext.Array.each(records, function(user_rec) {
                    var user = {
                                    FullName: user_rec.get('FirstName') + ' ' + user_rec.get('LastName'),
                                    Role: user_rec.get('Role')
                                }
                    users.push(user);

                    if(user_rec.get('Role')=='Product Owner'){
                        po_oids.push(user_rec.get('ObjectID'));
                    }

                    if(user_rec.get('Role')=='Scrum Master'){
                        sm_oids.push(user_rec.get('ObjectID'));
                    }
                    

                }); 

                Deft.Promise.all([me._getCounts(record,po_oids,sm_oids)],me).then({
                    success: function(results){
                        var allCollection = {
                            TCCounts: results[0],
                            POorSMNames:users
                        };
                        deferred.resolve(allCollection)
                    },
                    failure: function(){},
                    scope: me
                });

                //deferred.resolve(users);
            }
        });

        return deferred;
    },




    _getCounts: function(record,po_oids,sm_oids){
        var deferred = Ext.create('Deft.Deferred');
        console.log('po_oids',po_oids);
        var me = this;
        console.log(me.release);
        var filters =   [
                            { property: 'Project.ObjectID', value: record.get('ObjectID')},
                            { property: 'Release.Name',value:me.release.rawValue}
                        ];

        Ext.create('Rally.data.wsapi.Store',{
            model: 'UserStory',
            fetch: ['ObjectID','ScheduleState','PassingTestCaseCount', 'TestCaseCount','Defects','TestCases'],
            filters: filters
            // ,
            // limit: 1,
            // pageSize: 1
        }).load({
            callback: function(records, operation, success){
                if (success){
                    var tc_counts = []
                    console.log('_fetchAttributeCounts>>',records)
                    var total_tc = 0;
                    var total_tc_pass = 0;
                    var total_defects = 0;
                    
                    var project_promises = [];
                    var user_story_ids = [];
                    var attach_filters = [];
                    var tc_filters = [];
                    var user_story_state = [];


                    Ext.Array.each(records, function(user_story) {
                        total_tc += user_story.get('TestCaseCount');
                        total_tc_pass += user_story.get('PassingTestCaseCount');
                        total_defects += user_story.get('Defects').Count;
                        user_story_ids.push(user_story.get('ObjectID'));
                        user_story_state.push({ObjectID:user_story.get('ObjectID'),ScheduleState:user_story.get('ScheduleState')});
                        attach_filters.push({ property: 'TestCaseResult.TestCase.WorkProduct.ObjectID', value: user_story.get('ObjectID')});
                        tc_filters.push({ property: 'WorkProduct.ObjectID', value: user_story.get('ObjectID')});
                    });

                    project_promises.push(function(){
                        return me._getStoriesAcceptedByPO(user_story_ids,po_oids,user_story_state); 
                    });

                    project_promises.push(function(){
                        return me._getStoriesAcceptedBySM(user_story_ids,sm_oids,user_story_state); 
                    });

                    //Get Total Attachments.
                    project_promises.push(function(){
                        if(0 < attach_filters.length){
                            return me.fetchWsapiCount('Attachment',Rally.data.wsapi.Filter.or(attach_filters)); 
                        }else{
                            return 0;
                        }
                    });


                    if(0 < tc_filters.length){
                        tc_filters_for_wsapi = Rally.data.wsapi.Filter.or(tc_filters).and({ property: 'Type',value:'User Acceptance Testing'});
                    }


                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            return me.fetchWsapiCount('TestCase',tc_filters_for_wsapi); 
                        }else{
                            return 0;
                        }
                    });


                    if(0 < tc_filters.length){
                        tc_pass_filters_for_wsapi = Rally.data.wsapi.Filter.or(tc_filters).and({ property: 'Type',value:'User Acceptance Testing'}).and({ property: 'LastVerdict',value:'Pass'});
                    }


                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            return me.fetchWsapiCount('TestCase',tc_pass_filters_for_wsapi); 
                        }else{
                            return 0;
                        }
                    });

                    // Get Total Test Cases Executed.
                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            return me._getTotalTCExecuted(Rally.data.wsapi.Filter.or(tc_filters),Rally.data.wsapi.Filter.or(attach_filters));
                        }else{
                            return 0;
                        }
                    });


                    Deft.Chain.sequence(project_promises).then({
                        success: function(results){
                            console.log('after lookback>>',results);
                            var tc_counts = {
                                TotalTestCases: total_tc,
                                PassedTestCases: total_tc_pass,
                                TotalDefects: total_defects,
                                UserStoryCount:user_story_ids.length,
                                USAcceptedByPO:results[0],
                                USAcceptedBySM:results[1],
                                TotalAttachments:results[2],
                                UATTCCounts:results[3],
                                UATTCPassCounts:results[4],
                                TotalTCExecuted:results[5]
                            }
                            deferred.resolve(tc_counts);

                        },
                        scope:me                   
                    });

                } else {
                   // deferred.reject(Ext.String.format("Error getting {0} count for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });

        return deferred;
    },
    
    
    fetchWsapiCount: function(model, query_filters){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: model,
            fetch: ['ObjectID'],
            enablePostGet: true,
            filters: query_filters,
            limit: 1,
            pageSize: 1
        }).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(operation.resultSet.totalRecords);
                } else {
                    deferred.reject(Ext.String.format("Error getting {0} count for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    },

    /*
        Get snapshots where _User  is in PO Users of the project
        AND Schedule State  = "Accepted"
        AND UserStory ObjectID = obj ids in project.
        AND previous Values of State should be <>
        sort by _validFrom
        DIrectChildren = 0 
        What happens if We have if a value moved from Release to prod to accepted. 
        How to get unique values. 
    */

    _getStoriesAcceptedByPO: function(user_story_ids,po_oids,user_story_state){
        var deferred = Ext.create('Deft.Deferred');


        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            "context": this.getContext().getDataContext(),
            "fetch": ["ScheduleState", "PlanEstimate"],
            "hydrate": ["ScheduleState"],
            "find": {
                    "ObjectID": { "$in": user_story_ids },
                    "_User": { "$in": po_oids },
                    "_TypeHierarchy": "HierarchicalRequirement",
                    "ScheduleState": "Accepted",
                    "_PreviousValues.ScheduleState": { "$ne": "Accepted" },
                    "Children": null
                },
            "sort": { "_ValidFrom": -1 }
           
        });

        snapshotStore.load({
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    var total_us_accepted_by_po = 0
                    Ext.Array.each(user_story_state,function(uss){
                        Ext.Array.each(records,function(rec){
                            if(rec.get('ObjectID')==uss.ObjectID && (uss.ScheduleState == 'Accepted' || uss.ScheduleState == 'Released to Prod')){
                                total_us_accepted_by_po += 1;
                                return false;
                            }
                        });
                    });
                    var result_pc = user_story_ids.length > 0 ? ( total_us_accepted_by_po/user_story_ids.length) * 100 : 0;
                    var result = {Stories:total_us_accepted_by_po,Percentage:Ext.util.Format.number(result_pc, "000.00")};
                    deferred.resolve(result);

                }
            }
        });
    
    return deferred;

    },
    
    _getStoriesAcceptedBySM: function(user_story_ids,sm_oids,user_story_state){
        var deferred = Ext.create('Deft.Deferred');


        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            "context": this.getContext().getDataContext(),
            "fetch": ["ScheduleState", "PlanEstimate"],
            "hydrate": ["ScheduleState"],
            "find": {
                    "ObjectID": { "$in": user_story_ids },
                    "_User": { "$in": sm_oids },
                    "_TypeHierarchy": "HierarchicalRequirement",
                    "ScheduleState":  "Released to Prod" ,
                    "_PreviousValues.ScheduleState": { "$ne": "Released to Prod" },
                    "Children": null
                },
            "sort": { "_ValidFrom": -1 }
        });

        snapshotStore.load({
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    var total_us_accepted_by_sm = 0
                    Ext.Array.each(user_story_state,function(uss){
                        Ext.Array.each(records,function(rec){
                            if(rec.get('ObjectID')==uss.ObjectID && uss.ScheduleState == 'Released to Prod'){
                                total_us_accepted_by_sm += 1;
                                return false;
                            }
                        });
                    });
                    var result_pc = user_story_ids.length > 0 ? ( total_us_accepted_by_sm/user_story_ids.length) * 100 : 0;
                    var result = {Stories:total_us_accepted_by_sm,Percentage:Ext.util.Format.number(result_pc, "000.00")};
                    deferred.resolve(result);
                }
            }
        });
    
    return deferred;


    },

    // Total Number of TC executed in the Release
    // definition of executed: criteria :has a verdict, has attachment on the result, executed within the timebox, tied to a user story part of the release. 
   _getTotalTCExecuted: function(tc_filters,attach_filters){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;

        var tc_promises = [];

        tc_promises.push(function(){
            if(attach_filters!=null){
                return me._getAttachmentsForUS(Rally.data.wsapi.Filter.or(attach_filters))
            }else{
                return null;
            }
        });

        tc_promises.push(function(){
            if(attach_filters!=null){
                return me._getTestCasesForUS(Rally.data.wsapi.Filter.or(tc_filters))
            }else{
                return null;
            }
        });

        Deft.Chain.sequence(tc_promises).then({
            success: function(results){
                var has_verdict = false;
                var has_attachment = false;
                var executed_with_in_release = false;
                var total_executed = 0;
                var total_uat_executed = 0;

                Ext.Array.each(results[1],function(test_case){
                    has_verdict = false;
                    executed_with_in_release = false;
                    // check if the TestCase has a verdict
                    if(test_case.LastVerdict!=null || test_case.LastVerdict!=""){
                        has_verdict = true;

                        if(test_case.LastRun < me.release.lastSelection[0].get('ReleaseDate') && test_case.LastRun > me.release.lastSelection[0].get('ReleaseStartDate')){
                            executed_with_in_release = true;
                        }
                    }
                    //check if the TestCase was executed with in the current release

                    //check if there's an attachment for each user story
                    has_attachment = false;
                    Ext.Array.each(results[0],function(attachment){
                        if(attachment.TestCaseOID == test_case.TestCaseOID){
                            has_attachment = true;
                            return false;
                        }

                    });


                    if(has_attachment && has_verdict && executed_with_in_release){
                        total_executed += 1;
                    }

                    // all conditions + UAT type.
                    if(has_attachment && has_verdict && executed_with_in_release && test_case.Type == "User Acceptance Testing"){
                        total_uat_executed += 1;
                    }

                });

                var executed_totals = {
                    TotalExecuted:total_executed,
                    TotalUATExecuted:total_uat_executed
                }

                deferred.resolve(executed_totals);

            },
            scope:me                   
        });

        return deferred;
    },

    
    _getAttachmentsForUS: function(attach_filters){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: 'Attachment',
            fetch: ['ObjectID','TestCaseResult','TestCase','WorkProduct'],
            enablePostGet: true,
            filters: attach_filters
        }).load({
            callback: function(records, operation, success){
                if (success){
                    var attachments = [];
                    Ext.Array.each(records,function(attachment){
                        attachments.push({AttachmentOID:attachment.get('ObjectID'),
                                            UserStoryOID:attachment.get('TestCaseResult').TestCase.WorkProduct.ObjectID,
                                            TestCaseOID:attachment.get('TestCaseResult').TestCase.ObjectID});
                    });

                    deferred.resolve(attachments);
                } else {
                    deferred.reject('Problem loading Attachments');
                }
            }
        });

        return deferred;
    },

    _getTestCasesForUS: function(tc_filters){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: 'TestCase',
            fetch: ['ObjectID','WorkProduct','LastVerdict','LastRun','Type'],
            enablePostGet: true,
            filters: tc_filters
        }).load({
            callback: function(records, operation, success){
                if (success){
                    var test_cases = [];
                    Ext.Array.each(records,function(test_case){
                        test_cases.push({  TestCaseOID:test_case.get('ObjectID'),
                                            UserStoryOID:test_case.get('WorkProduct').ObjectID,
                                            LastVerdict:test_case.get('LastVerdict'),
                                            Type:test_case.get('Type'),
                                            LastRun:test_case.get('LastRun')});
                    });

                    deferred.resolve(test_cases);
                } else {
                    deferred.reject('Problem loading TestCases');
                }
            }
        });

        return deferred;
    },

 

// Project Name

// PO Name

// %age of US Accepted by PO

// SM Name

// %age of US release to Prod by SM

// Total number of TC in the release

// Total Number of TC executed in the Release

// # of TC passes

// #of UAT TC in the release

// # of UAT TC Executed in the release

// # of UAT TC Passed

// # of Attachment

// # of Defects
    
    _displayGrid: function(store,field_names){
        var display_box = this.down('#display_box');
        display_box.removeAll();

        display_box.add({
            xtype: 'rallygrid',
            store: store,
            features: [{
                ftype: 'summary'
            }],
            columnCfgs: [
                {
                    text: 'PROJECT', 
                    dataIndex: 'ProjectName',
                    flex: 2,
                    summaryRenderer: function() {
                        return '<align=left><b>TOTAL</b></align>'; 
                    }
                },
                {
                    text: 'USER STORY COUNT', 
                    dataIndex: 'UserStoryCount',
                    flex: 1,
                    summaryType:'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                        text: 'PO NAME', 
                        dataIndex: 'POorSMNames',
                        flex: 2,
                        renderer: function(POorSMNames){
                            var text = [];
                            if(POorSMNames){
                                    Ext.Array.each(POorSMNames, function(user) {
                                        if('Product Owner' == user.Role){
                                            text.push(user.FullName);
                                        }
                                    });
                            }else{
                                text.push('NA');
                            }

                            return text;
                        }

                },
                {
                    text: 'PO ACCEPTED USER STORY COUNT / %', 
                    dataIndex: 'USAcceptedByPO',
                    flex: 1,
                    renderer: function(USAcceptedByPO){
                        return USAcceptedByPO.Stories + ' / ' + USAcceptedByPO.Percentage+ '%';
                    }
                },
                {
                        text: 'SM NAME', 
                        dataIndex: 'POorSMNames',
                        flex: 2,
                        renderer: function(POorSMNames){
                            var text = [];
                            if(POorSMNames){
                                    Ext.Array.each(POorSMNames, function(user) {
                                        if('Scrum Master' == user.Role){
                                            text.push(user.FullName);
                                        }
                                    });
                            }else{
                                text.push('NA');
                            }

                            return text;
                        }
                },
                {
                    text: 'SM RELEASED TO PROD USER STORY COUNT / %', 
                    dataIndex: 'USAcceptedBySM',
                    flex: 1,
                    renderer: function(USAcceptedBySM){
                        return USAcceptedBySM.Stories + ' / ' + USAcceptedBySM.Percentage+ '%';
                    }

                },
                {
                    text: 'TOTAL TESTS COUNT', 
                    dataIndex: 'TotalTestCases',
                    flex: 1,
                    summaryType:'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'TOTAL TESTS <b>EXECUTED</b>', 
                    dataIndex: 'TotalExecuted',
                    flex: 1,
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }


                },
                {
                    text: 'NUMBER OF TESTS WITH RESULT ATTACHMENTS', 
                    dataIndex: 'TotalAttachments',
                    flex: 1,
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'PASSED TESTS', 
                    dataIndex: 'PassedTestCases',
                    flex: 1,
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'TOTAL UAT TESTS COUNT', 
                    dataIndex: 'UATTCCounts',
                    flex: 1,
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }


                },
                {
                    text: 'TOTAL UAT TESTS <b>EXECUTED</b>', 
                    dataIndex: 'TotalUATExecuted',
                    flex: 1,
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }


                },
                {
                    text: 'PASSED UAT TESTS', 
                    dataIndex: 'UATTCPassCounts',
                    flex: 1,
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'TOTAL DEFECTS', 
                    dataIndex: 'TotalDefects',
                    flex: 1,
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                }
                ]
        });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
