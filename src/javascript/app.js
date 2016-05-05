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

    //this.getSetting('testCaseType');
    config: {
        defaultSettings: {
            includeTestSets:false,
            testCaseType:'User Acceptance Testing',
            smRole: 'Scrum/Agile Master',
            poRole: 'Product Owner'
        }
    },

    getSettingsFields: function() {
        var me = this;

        return [
            {
                name: 'includeTestSets',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Include TestSets<br/><span style="color:#999999;"><i>Tick to include the TestCases in a TestSet</i></span>'
            },
            {
                name: 'testCaseType',
                xtype: 'rallyfieldvaluecombobox',
                fieldLabel: 'UAT Type',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 200,
                margin: 10,
                autoExpand: false,
                alwaysExpanded: false,                
                model: 'TestCase',
                field: 'Type',
                readyEvent: 'ready',
                listeners: {
                    ready: function(cb) {
                        cb.setValue(me.getSetting('testCaseType'));
                    }
                }
            },
            {
                name: 'smRole',
                xtype: 'rallyfieldvaluecombobox',
                fieldLabel: 'Scrum Master Role',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 200,
                margin: 10,
                autoExpand: false,
                alwaysExpanded: false,
                model: 'User',
                field: 'Role',
                readyEvent: 'ready',
                listeners: {
                    ready: function(cb) {
                        cb.setValue(me.getSetting('smRole'));
                    }
                }
            },
            {
                name: 'poRole',
                xtype: 'rallyfieldvaluecombobox',
                fieldLabel: 'Product Owner Role',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 200,
                margin: 10,
                autoExpand: false,
                alwaysExpanded: false,
                model: 'User',
                field: 'Role',
                readyEvent: 'ready',
                listeners: {
                    ready: function(cb) {
                        cb.setValue(me.getSetting('poRole'));
                    }
                }
            }
        ];
    },
                        
    launch: function() {
        var me = this;

        me._addSelector();
    },
    



    _addSelector: function() {
        var selector_box = this.down('#selector_box');
            selector_box.removeAll();

        var project_name = this.getContext().get('project').Name;


        filters = [
             {property:'Name',  value: project_name},
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
 
         filter = Rally.data.wsapi.Filter.or(filters);

            
        selector_box.add({
            xtype:'rallyreleasecombobox',
            fieldLabel: 'Release:',
            width:500,
            margin:10,
            showArrows : false,
            context : this.getContext(),
            growToLongestValue : true,
            defaultToCurrentTimebox : true,
            listeners: {
                scope: this,
                change: function(rcb) {
                    this.release = rcb;
                }
            }
        });

        selector_box.add({
            xtype:'rallycombobox',
            id:'projectCombobox',
            multiSelect: true,
            allowNoEntry:true,
            autoSelect: true,
            fieldLabel: 'Project:',
            labelAlign: 'right',
            noEntryText: '--All--',
            noEntryValue:null,
            value: '--All--',
            width:400,
            storeConfig: {
                autoLoad: true,
                model: 'Project',
                filters: filter,
                remoteFilter: true
            },
            listeners: {
                scope: this,
                ready: function(cb){
                    cb.setValue('--All--');
                    cb.setValueField(null);
                },
                change: function(cb) {
                        if(cb.lastSelection.length ==0 || (cb.lastSelection.length > 0 && cb.lastSelection[0].get('ObjectID') == null) ){
                            this.project_filter = filter;
                        }else{
                            var project_filters = [];
                            Ext.Array.each(cb.lastSelection,function(project){
                                project_filters.push({property:'ObjectID',  value: project.get('ObjectID')});
                            });
                            this.project_filter = Rally.data.wsapi.Filter.or(project_filters)        
                        }
                }
            },
            margin:10
        });

        selector_box.add({
            xtype: 'rallybutton',
            text: 'Update',
            // width: 200,
            margin:10,
            cls: 'primary',
            listeners: {
                click: this._getArtifacts,
                scope: this
            }
        });

    },

    _getArtifacts: function(){
        var me = this;
        this.setLoading("Loading Projects...");
        me.totalPOAccepted  = 0;
        me.totalNonPOAccepted  = 0;
        me.totalSMAccepted  = 0;
        me.totalNonSMAccepted  = 0;
        me.totalUserStoryCount = 0;

 
        var release_filter = Ext.create('Rally.data.wsapi.Filter', {
             property: 'Releases.Name',
             operator: 'contains',
             value: me.release.rawValue
        });

        project_filter = release_filter.and(this.project_filter);

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


                if(successful){
                    if (records.length > 0){
                        deferred.resolve(records);
                    } else {
                        me.logger.log("No Projects Found", operation);
                        deferred.reject("No Projects Found!");
                    }
                }else{
                    deferred.reject("Problem Loading Data. See logs");
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
        //console.log('Settings >>',me.getSetting('testCaseType'),me.getSetting('smRole'),me.getSetting('poRole'));

        Deft.Promise.all(me._loadAStoreWithAPromiseModel(model_name, model_fields,filter)).then({
            success: function(records){
                    //console.log('total users -yay',records)
                    if (records){
                        var promises = [];
                        var totalProjects = records.length,
                        me = this;
                        _.each(records, function(result){
                            promises.push(function(){
                                return me._getCollection(result); 
                            });
                        },me);

                        PortfolioItemCostTracking.promise.ParallelThrottle.throttle(promises, 12, me).then({
                        //Deft.Chain.sequence(promises).then({
                            success: function(results){
                                console.log('All permissions >>',results,results.length);
                                var projects = [];

                                for (var i = 0; records && i < records.length; i++) {
                                        var project = {
                                            ProjectName: records[i].get('Name'),
                                           // TCCounts: results[i].TCCounts,
                                            POorSMNames:results[i].POorSMNames,
                                            TotalTestCases:results[i].TCCounts.TotalTestCases,
                                            TotalExecuted:results[i].TCCounts.TotalTCExecuted ? results[i].TCCounts.TotalTCExecuted.TotalExecuted : 0,
                                            TotalAttachments:results[i].TCCounts.TotalAttachments,
                                            PassedTestCases:results[i].TCCounts.PassedTestCases,
                                            UATTCCounts:results[i].TCCounts.UATTCCounts,
                                            TotalUATExecuted:results[i].TCCounts.TotalTCExecuted ? results[i].TCCounts.TotalTCExecuted.TotalUATExecuted:0,
                                            UATTCPassCounts:results[i].TCCounts.UATTCPassCounts,
                                            TotalDefects:results[i].TCCounts.TotalDefects,
                                            USAcceptedByPO:results[i].TCCounts.USAcceptedByPO,
                                            USAcceptedBySM:results[i].TCCounts.USAcceptedBySM,
                                            UserStoryCount:results[i].TCCounts.UserStoryCount
                                        }
                                        projects.push(project);
                                        me.totalUserStoryCount += results[i].TCCounts.UserStoryCount;
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

                    deferred.reject(error_message);

                },
                scope: me
            });
            return deferred.promise;
           
    },

    _getCollection: function(record){
        me = this;
        var deferred = Ext.create('Deft.Deferred');

         var users = [];
         var sm_oids = [];
         var po_oids = [];

        record.getCollection('Editors').load({
            fetch: ['ObjectID', 'FirstName', 'LastName','Role'],
            scope: me,
            callback: function(records, operation, success) {
                Ext.Array.each(records, function(user_rec) {
                    var user = {    
                                    ObjectID:user_rec.get('ObjectID'),
                                    FullName: user_rec.get('FirstName') + ' ' + user_rec.get('LastName'),
                                    Role: user_rec.get('Role')
                                }
                    // if(user_rec.get('Role')==me.getSetting('poRole') || user_rec.get('Role')==me.getSetting('smRole')){
                        users.push(user);
                    // }

                    // if(user_rec.get('Role')==me.getSetting('poRole')){
                        po_oids.push(user_rec.get('ObjectID'));
                    // }

                    // if(user_rec.get('Role')==me.getSetting('smRole')){
                        sm_oids.push(user_rec.get('ObjectID'));
                    // }
                    

                }); 

                Deft.Promise.all([me._getCounts(record,po_oids,sm_oids,users)],me).then({
                    success: function(results){
                        var allCollection = {
                            TCCounts: results[0],
                            POorSMNames:users
                        };
                        deferred.resolve(allCollection)
                    },
                    failure: function(error_message){
                        deferred.reject(error_message);
                    },
                    scope: me
                });

            }
        });

        return deferred;
    },



    _getCounts: function(record,po_oids,sm_oids,users){
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

        }).load({
            scope: me,
            callback: function(records, operation, success){
                if (success){
                    var tc_counts = []
                    console.log('_fetchAttributeCounts>>',records)
                    var total_defects = 0;
                    
                    var project_promises = [];
                    var user_story_ids = [];
                    var attach_filters = [];
                    var tc_filters = [];
                    var user_story_state = [];


                    Ext.Array.each(records, function(user_story) {
                        total_defects += user_story.get('Defects').Count;
                        user_story_ids.push(user_story.get('ObjectID'));
                        user_story_state.push({ObjectID:user_story.get('ObjectID'),ScheduleState:user_story.get('ScheduleState')});
                        attach_filters.push({ property: 'TestCaseResult.TestCase.WorkProduct.ObjectID', value: user_story.get('ObjectID')});
                        tc_filters.push({ property: 'WorkProduct.ObjectID', value: user_story.get('ObjectID')});
                    });



                    //filters to include the TestCases of the TestSets
                    var tc_release_project_filters =    Rally.data.wsapi.Filter.and([
                                                            { property: 'TestSets.Project.ObjectID', value: record.get('ObjectID')},
                                                            { property: 'TestSets.Release.Name',value:me.release.rawValue}
                                                        ]);

                    //filters to include the Attachments of TestCases of the TestSets
                    var attach_release_project_filters   =  Rally.data.wsapi.Filter.and([
                                                { property: 'TestCaseResult.TestCase.TestSets.Project.ObjectID', value: record.get('ObjectID')},
                                                { property: 'TestCaseResult.TestCase.TestSets.Release.Name',value:me.release.rawValue}
                                            ]);                    

                    //1. Get Total test cases.
                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            if(me.getSetting('includeTestSets')){
                                return me.fetchWsapiCount('TestCase',Rally.data.wsapi.Filter.or(tc_filters).or(tc_release_project_filters)); 
                            }else{
                                return me.fetchWsapiCount('TestCase',Rally.data.wsapi.Filter.or(tc_filters)); 
                            }
                        }else{
                            return 0;
                        }
                    });

                    //2. Total Passed Test cases
                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            if(me.getSetting('includeTestSets')){
                                return me.fetchWsapiCount('TestCase',Rally.data.wsapi.Filter.or(tc_filters).or(tc_release_project_filters).and({ property: 'LastVerdict',value:'Pass'})); 
                            }else{
                                return me.fetchWsapiCount('TestCase',Rally.data.wsapi.Filter.or(tc_filters).and({ property: 'LastVerdict',value:'Pass'})); 
                            }
                        }else{
                            return 0;
                        }
                    });

                    //3. Lookback API Call to get Stories accepted by Product Owner 
                    project_promises.push(function(){
                        return me._getStoriesAcceptedByPO(user_story_ids,po_oids,user_story_state,users); 
                    });

                    //4. Lookback API Call to get Stories accepted by Scrum Master
                    project_promises.push(function(){
                        return me._getStoriesAcceptedBySM(user_story_ids,sm_oids,user_story_state,users); 
                    });

                    //5. Get Total Attachments.
                    project_promises.push(function(){
                        if(0 < attach_filters.length){
                            if(me.getSetting('includeTestSets')){
                                return me.fetchWsapiCount('Attachment',Rally.data.wsapi.Filter.or(attach_filters).or(attach_release_project_filters)); 
                            }else{
                                return me.fetchWsapiCount('Attachment',Rally.data.wsapi.Filter.or(attach_filters)); 
                            }
                        }else{
                            return 0;
                        }
                    });

                    //filters for Total Testcases based on the case type (UAT)
                    if(0 < tc_filters.length){
                        if(me.getSetting('includeTestSets')){
                            tc_filters_for_wsapi = Rally.data.wsapi.Filter.or(tc_filters).or(tc_release_project_filters).and({ property: 'Type',value:me.getSetting('testCaseType')});
                        }else{
                            tc_filters_for_wsapi = Rally.data.wsapi.Filter.or(tc_filters).and({ property: 'Type',value:me.getSetting('testCaseType')});
                        }
                    }

                    //6. Get Total Testcases based on the case type (UAT)
                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            return me.fetchWsapiCount('TestCase',tc_filters_for_wsapi); 
                        }else{
                            return 0;
                        }
                    });


                    //filters for total Testcases based on the case type (UAT) and verdict (passed ones)
                    if(0 < tc_filters.length){
                        if(me.getSetting('includeTestSets')){
                            tc_pass_filters_for_wsapi = Rally.data.wsapi.Filter.or(tc_filters).or(tc_release_project_filters).and({ property: 'Type',value:me.getSetting('testCaseType')}).and({ property: 'LastVerdict',value:'Pass'});
                        }else{
                            tc_pass_filters_for_wsapi = Rally.data.wsapi.Filter.or(tc_filters).and({ property: 'Type',value:me.getSetting('testCaseType')}).and({ property: 'LastVerdict',value:'Pass'});
                        }                        
                    }

                    //7. Get Total Testcases based on the case type (UAT) and verdict (passed ones)
                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            return me.fetchWsapiCount('TestCase',tc_pass_filters_for_wsapi); 
                        }else{
                            return 0;
                        }
                    });

                    //8. Get Total Test Cases Executed.
                    project_promises.push(function(){
                        if(0 < tc_filters.length){
                            return me._getTotalTCExecuted(Rally.data.wsapi.Filter.or(tc_filters),Rally.data.wsapi.Filter.or(attach_filters),tc_release_project_filters,attach_release_project_filters);
                        }else{
                            return 0;
                        }
                    });


                    Deft.Chain.sequence(project_promises).then({
                        success: function(results){
                            //console.log('after lookback>>',results);
                            var tc_counts = {
                                TotalTestCases: results[0],
                                PassedTestCases: results[1],
                                UserStoryCount:user_story_ids.length,
                                USAcceptedByPO:results[2],
                                USAcceptedBySM:results[3],
                                TotalAttachments:results[4],
                                UATTCCounts:results[5],
                                UATTCPassCounts:results[6],
                                TotalTCExecuted:results[7],
                                TotalDefects: total_defects
                            }
                            deferred.resolve(tc_counts);

                        },
                        scope:me                   
                    });

                } else{
                    deferred.reject('Problem getting Data');
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

    _getStoriesAcceptedByPO: function(user_story_ids,po_oids,user_story_state,users){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            "context": this.getContext().getDataContext(),
            "fetch": ["ScheduleState", "_User",],
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
                    var po_accepted = [];
                    Ext.Array.each(user_story_state,function(uss){
                        Ext.Array.each(records,function(rec){
                            if(rec.get('ObjectID')==uss.ObjectID && (uss.ScheduleState == 'Accepted' || uss.ScheduleState == 'Released to Prod')){
                                total_us_accepted_by_po += 1;
                                po_accepted.push({ObjectID:rec.get('ObjectID'), UserObjectID:rec.get('_User')});
                                return false;
                            }
                        });
                    });
                    var users_with_accepted = [];

                    Ext.Array.each(users,function(user){
                        var total_accepted = 0;
                        Ext.Array.each(po_accepted, function(poa){
                            if(user.ObjectID==poa.UserObjectID){
                                total_accepted += 1;
                            }
                        });

                        var user = {    
                                    ObjectID:user.ObjectID,
                                    FullName: user.FullName,
                                    Role: user.Role,
                                    TotalAccepted: total_accepted,
                                    TotalAcceptedPercent:Ext.util.Format.number(user_story_ids.length > 0 ? ( total_accepted/user_story_ids.length) * 100 : 0, "000.00")
                        }

                        if(me.getSetting('poRole') == user.Role){
                            me.totalPOAccepted  += total_accepted;
                        }else{
                            me.totalNonPOAccepted  += total_accepted;
                        }
                        
                        users_with_accepted.push(user);
                    });

                    var result_pc = user_story_ids.length > 0 ? ( total_us_accepted_by_po/user_story_ids.length) * 100 : 0;
                    var result = {Stories:total_us_accepted_by_po,Percentage:Ext.util.Format.number(result_pc, "000.00"),Users:users_with_accepted};

                    deferred.resolve(result);

                }else{
                    deferred.reject('Problem querying lookback');
                }
            },
            scope:me
        });
    
    return deferred;

    },
    
    _getStoriesAcceptedBySM: function(user_story_ids,sm_oids,user_story_state,users){
        var deferred = Ext.create('Deft.Deferred');

        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            "context": this.getContext().getDataContext(),
            "fetch": ["ScheduleState", "_User"],
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
                    var sm_accepted = [];

                    Ext.Array.each(user_story_state,function(uss){
                        Ext.Array.each(records,function(rec){
                            if(rec.get('ObjectID')==uss.ObjectID && uss.ScheduleState == 'Released to Prod'){
                                total_us_accepted_by_sm += 1;
                                sm_accepted.push({ObjectID:rec.get('ObjectID'), UserObjectID:rec.get('_User')});
                                return false;
                            }
                        });
                    });

                    var users_with_accepted = [];

                    Ext.Array.each(users,function(user){
                        var total_accepted = 0;
                        Ext.Array.each(sm_accepted, function(sma){
                            if(user.ObjectID==sma.UserObjectID){
                                total_accepted += 1;
                            }
                        });

                        var user = {    
                                    ObjectID:user.ObjectID,
                                    FullName: user.FullName,
                                    Role: user.Role,
                                    TotalAccepted: total_accepted,
                                    TotalAcceptedPercent:Ext.util.Format.number(user_story_ids.length > 0 ? ( total_accepted/user_story_ids.length) * 100 : 0, "000.00")
                        }

                        if(me.getSetting('smRole') == user.Role){
                            me.totalSMAccepted  += total_accepted;
                        }else{
                            me.totalNonSMAccepted  += total_accepted;
                        }

                        users_with_accepted.push(user);
                    });

                    var result_pc = user_story_ids.length > 0 ? ( total_us_accepted_by_sm/user_story_ids.length) * 100 : 0;
                    var result = {Stories:total_us_accepted_by_sm,Percentage:Ext.util.Format.number(result_pc, "000.00"),Users:users_with_accepted};

                    deferred.resolve(result);
                }else{
                    deferred.reject('Problem querying lookback');
                }
            }
        });
    
    return deferred;


    },

    // Total Number of TC executed in the Release
    // definition of executed: criteria :has a verdict, has attachment on the result, executed within the timebox, tied to a user story part of the release. 
   _getTotalTCExecuted: function(tc_filters,attach_filters,tc_release_project_filters,attach_release_project_filters){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;

        var tc_promises = [];

        tc_promises.push(function(){
            if(attach_filters!=null){
                if(me.getSetting('includeTestSets')){
                    return me._getAttachmentsForUS(Rally.data.wsapi.Filter.or(attach_filters).or(attach_release_project_filters));
                }else{
                    return me._getAttachmentsForUS(Rally.data.wsapi.Filter.or(attach_filters));
                }
            }else{
                return null;
            }
        });

        tc_promises.push(function(){
            if(tc_filters!=null){
                if(me.getSetting('includeTestSets')){
                    return me._getTestCasesForUS(Rally.data.wsapi.Filter.or(tc_filters).or(tc_release_project_filters));
                }else{
                    return me._getTestCasesForUS(Rally.data.wsapi.Filter.or(tc_filters));                  
                }
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
                    //check if the TestCase was executed with in the current release

                    if(test_case.LastVerdict!=null || test_case.LastVerdict!=""){
                        has_verdict = true;

                        if(test_case.LastRun < me.release.lastSelection[0].get('ReleaseDate') && test_case.LastRun > me.release.lastSelection[0].get('ReleaseStartDate')){
                            executed_with_in_release = true;
                        }
                    }

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
                    if(has_attachment && has_verdict && executed_with_in_release && test_case.Type == me.getSetting('testCaseType')){
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
        var me = this;
        var display_box = this.down('#display_box');
        display_box.removeAll();
        display_box.add({
            xtype: 'rallygrid',
            store: store,
            features: [{
                ftype: 'summary'
            }],
            scope: me,
            showRowActionsColumn: false,
            columnCfgs: [
                {
                    text: 'PROJECT', 
                    dataIndex: 'ProjectName',
                    flex: 2,
                    summaryRenderer: function() {
                        return '<b>TOTAL</b>'; 
                    }
                },
                {
                    text: 'USER STORY COUNT', 
                    dataIndex: 'UserStoryCount',
                    flex: 1,
                    align: 'center',
                    summaryType:'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'PO ACCEPTED USER STORY COUNT / %', 
                    dataIndex: 'USAcceptedByPO',
                    flex: 2,
                    renderer: function(USAcceptedByPO){
                        var text = [];
                        if(USAcceptedByPO.Users){
                            Ext.Array.each(USAcceptedByPO.Users, function(user) {
                                if(me.getSetting('poRole') == user.Role){
                                    text.push(user.FullName +' ('+user.TotalAccepted+' / '+user.TotalAcceptedPercent+'%)');
                                }
                            });
                        }else{
                            text.push('NA');
                        }

                        return text.join('<br/>');
                    },
                    summaryRenderer: function() {
                        return '<b>'+me.totalPOAccepted+' / '+Ext.util.Format.number(me.totalUserStoryCount > 0 ? ( me.totalPOAccepted/me.totalUserStoryCount) * 100 : 0, "000.00")+'%</b>';
                    }

                },                
                // {
                //     text: 'NON PO ACCEPTED USER STORY COUNT / %', 
                //     dataIndex: 'USAcceptedByPO',
                //     flex: 2,
                //     align: 'center',
                //     renderer: function(USAcceptedByPO){
                //         return USAcceptedByPO.Stories + ' / ' + USAcceptedByPO.Percentage+ '%';
                //     }
                // },
                {
                    text: 'NON PO ACCEPTED USER STORY COUNT / %', 
                    dataIndex: 'USAcceptedByPO',
                    flex: 2,
                    renderer: function(USAcceptedByPO){
                            var text = [];
                            if(USAcceptedByPO.Users){
                                Ext.Array.each(USAcceptedByPO.Users, function(user) {
                                    if(me.getSetting('poRole') != user.Role && 0 < user.TotalAccepted){
                                        text.push(user.FullName +' ('+user.TotalAccepted+' / '+user.TotalAcceptedPercent+'%)');
                                    }
                                });
                            }else{
                                text.push('NA');
                            }

                            return text.join('<br/>');
                    },
                    summaryRenderer: function() {
                        return '<b>'+me.totalNonPOAccepted+' / '+Ext.util.Format.number(me.totalUserStoryCount > 0 ? ( me.totalNonPOAccepted/me.totalUserStoryCount) * 100 : 0, "000.00")+'%</b>';
                    }
                },
                {
                    text: 'SM RELEASED TO PROD USER STORY COUNT / %', 
                    dataIndex: 'USAcceptedBySM',
                    flex: 2,
                    renderer: function(USAcceptedBySM){
                        var text = [];
                        if(USAcceptedBySM.Users){
                                Ext.Array.each(USAcceptedBySM.Users, function(user) {
                                    if(me.getSetting('smRole') == user.Role){
                                        text.push(user.FullName +' ('+user.TotalAccepted+' / '+user.TotalAcceptedPercent+'%)');
                                    }
                                });
                        }else{
                            text.push('NA');
                        }

                        return text.join('<br/>');
                    },
                    summaryRenderer: function() {
                        return '<b>'+me.totalSMAccepted+' / '+Ext.util.Format.number(me.totalUserStoryCount > 0 ? ( me.totalSMAccepted/me.totalUserStoryCount) * 100 : 0, "000.00")+'%</b>';
                    }

                },
                // {
                //     text: 'NON SM RELEASED TO PROD USER STORY COUNT / %', 
                //     dataIndex: 'USAcceptedBySM',
                //     flex: 2,
                //     align: 'center',
                //     renderer: function(USAcceptedBySM){
                //         return USAcceptedBySM.Stories + ' / ' + USAcceptedBySM.Percentage+ '%';
                //     }

                // },
                {
                    text: 'NON SM RELEASED TO PROD USER STORY COUNT / %', 
                    dataIndex: 'USAcceptedBySM',
                    flex: 2,
                    renderer: function(USAcceptedBySM){
                        var text = [];
                        if(USAcceptedBySM.Users){
                                Ext.Array.each(USAcceptedBySM.Users, function(user) {
                                    if(me.getSetting('smRole') != user.Role && 0 < user.TotalAccepted){
                                        text.push(user.FullName +' ('+user.TotalAccepted+' / '+user.TotalAcceptedPercent+'%)');
                                    }
                                });
                        }else{
                            text.push('NA');
                        }

                        return text.join('<br/>');
                    },
                    summaryRenderer: function() {
                        return '<b>'+me.totalNonSMAccepted+' / '+Ext.util.Format.number(me.totalUserStoryCount > 0 ? ( me.totalNonSMAccepted/me.totalUserStoryCount) * 100 : 0, "000.00")+'%</b>';
                    }
                },                
                {
                    text: 'TOTAL TESTS COUNT', 
                    dataIndex: 'TotalTestCases',
                    flex: 1,
                    align: 'center',
                    summaryType:'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'TOTAL TESTS <b>EXECUTED</b>', 
                    dataIndex: 'TotalExecuted',
                    flex: 1,
                    align: 'center',
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }


                },
                {
                    text: 'NUMBER OF TESTS WITH RESULT ATTACHMENTS', 
                    dataIndex: 'TotalAttachments',
                    flex: 1,
                    align: 'center',
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'PASSED TESTS', 
                    dataIndex: 'PassedTestCases',
                    flex: 1,
                    align: 'center',
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'TOTAL UAT TESTS COUNT', 
                    dataIndex: 'UATTCCounts',
                    flex: 1,
                    align: 'center',
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }


                },
                {
                    text: 'TOTAL UAT TESTS <b>EXECUTED</b>', 
                    dataIndex: 'TotalUATExecuted',
                    flex: 1,
                    align: 'center',
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }


                },
                {
                    text: 'PASSED UAT TESTS', 
                    dataIndex: 'UATTCPassCounts',
                    flex: 1,
                    align: 'center',
                    summaryType: 'sum',
                    summaryRenderer:function(val){
                        return '<b>'+val+'</b>';
                    }

                },
                {
                    text: 'TOTAL DEFECTS', 
                    dataIndex: 'TotalDefects',
                    flex: 1,
                    align: 'center',
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
