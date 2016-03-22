Ext.define("PTBoard", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box'},
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
                listeners: {
                    scope: this,
                    change: function(rcb) {
                        this._getArtifacts(rcb);
                    }
                }
            });
    },


    _getArtifacts: function(rcb){
        var me = this;
        this.setLoading("Loading stuff...");
        console.log('release >>',rcb)
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
             {property:'Parent.Parent.Parent.Name', value: project_name}
        ]
 
        filter = Rally.data.wsapi.Filter.or(filters).and({property:'Children.Name', value:"" }).and(filter);
 
        var model_name = 'Project',
            field_names = ['Name','State','TeamMembers','User','Results','QueryResult'];
        
        this._loadAStoreWithAPromise(model_name, field_names,filter).then({
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
                                            TCCounts: results[i].TCCounts,
                                            TotalTCExecuted: results[i].TotalTCExecuted,
                                            UATTCCounts:results[i].UATTCCounts,
                                            TotalUATTCExecuted:results[i].TotalUATTCExecuted,
                                            POorSMNames:results[i].POorSMNames,
                                            TotalAttachments:results[i].TotalAttachments
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

                Deft.Promise.all([me._getTCCounts(record,po_oids),me._getTotalTCExecuted(record),me._getUATTCCounts(record),me._getTotalUATTCExecuted(record),me._getTotalAttachments(record)],me).then({
                    success: function(results){
                        var allCollection = {
                            TCCounts: results[0],
                            TotalTCExecuted: results[1],
                            UATTCCounts:results[2],
                            TotalUATTCExecuted:results[3],
                            TotalAttachments:results[4],
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


    _getPOorSMNames: function(record){
            var deferred = Ext.create('Deft.Deferred');
            var users = [];
            record.getCollection('TeamMembers').load({
                fetch: ['ObjectID', 'FirstName', 'LastName','Role'],
                callback: function(records, operation, success) {
                    Ext.Array.each(records, function(user) {
                    var user = {
                                    FullName: user.get('FirstName') + ' ' + user.get('LastName'),
                                    Role: user.get('Role')
                                }
                    users.push(user);
                    }); 
                    deferred.resolve(users);
                }
            });

            return deferred;

    },


    // Total Number of TC executed in the Release
    // definition of executed: criteria :has a verdict, has attachment on the result, executed within the timebox, tied to a user story part of the release. 
    _getTotalTCExecuted: function(record){
        var filters =   [
                            { property: 'Project.ObjectID', value: record.get('ObjectID')}
                        ];

        return this.fetchWsapiCount('TestCase',filters);
    },

    
    //# of UAT TC Executed in the release
    _getTotalUATTCExecuted: function(record){
        var filters =   [
                            { property: 'Project.ObjectID', value: record.get('ObjectID')},
                            { property: 'Type', value: 'User Acceptance Testing'}
                        ];

        return this.fetchWsapiCount('TestCase',filters);
    },

    // _getTotalAttachments: function(record){
    //     var filters =   [
    //                         { property: 'TestCaseResult.TestCase.WorkProduct.Project.ObjectID', value: record.get('ObjectID')},
    //                         { property: 'TestCaseResult.TestCase.WorkProduct.Release.Name',value:me.release.rawValue},
    //                         { property: 'TestCaseResult.TestCase.WorkProduct._type',value:'HierarchicalRequirement'}
    //                     ];

    //     return this.fetchWsapiCount('Attachment',filters);
    // },
    
    fetchWsapiCount: function(model, query_filters){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: model,
            fetch: ['ObjectID'],
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

    _getTCCounts: function(record,po_oids){
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
            fetch: ['ObjectID','PassingTestCaseCount', 'TestCaseCount','Defects','TestCases'],
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

                    Ext.Array.each(records, function(user_story) {
                        total_tc += user_story.get('TestCaseCount');
                        total_tc_pass += user_story.get('PassingTestCaseCount');
                        total_defects += user_story.get('Defects').Count;
                        user_story_ids.push(user_story.get('ObjectID'));
                    });

                    project_promises.push(function(){
                        return me._getStoriesAcceptedByPO(user_story_ids); 
                    });

                    Deft.Chain.sequence(project_promises).then({
                        success: function(results){
                            console.log('after lookback>>',results);
                            var tc_counts = {
                                TotalTestCases: total_tc,
                                PassedTestCases: total_tc_pass,
                                TotalDefects: total_defects,
                                USAcceptedByPO:results[0]
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

    _getStoriesAcceptedByPO: function(user_story_ids){
        var deferred = Ext.create('Deft.Deferred');


        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            "context": this.getContext().getDataContext(),
            "fetch": ["ScheduleState", "PlanEstimate"],
            "hydrate": ["ScheduleState"],
            "find": {
                    "ObjectID": { "$in": user_story_ids },
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
                    Ext.Array.each(user_story_ids,function(usid){
                        Ext.Array.each(records,function(rec){
                            if(rec.get('ObjectID')==usid){
                                total_us_accepted_by_po += 1;
                                return false;
                            }
                        });
                    });
                    var result_pc = user_story_ids.length > 0 ? ( total_us_accepted_by_po/user_story_ids.length) * 100 : 0;
                    deferred.resolve(Ext.util.Format.number(result_pc, "000.00"));
                }
            }
        });
    
    return deferred;

    },
    
    _getStoriesAcceptedBySM: function(record){



    },
    //TODO combine with method above.
    //(TestCases.Type = "User Acceptance Testing")
    _getUATTCCounts: function(record){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;
        console.log(me.release);
        var filters =   [
                            { property: 'Project.ObjectID', value: record.get('ObjectID')},
                            { property: 'Release.Name',value:me.release.rawValue},
                            { property: 'TestCases.Type',value:'User Acceptance Testing'}
                        ];

        Ext.create('Rally.data.wsapi.Store',{
            model: 'UserStory',
            fetch: ['ObjectID','PassingTestCaseCount', 'TestCaseCount'],
            filters: filters
            // ,
            // limit: 1,
            // pageSize: 1
        }).load({
            callback: function(records, operation, success){
                if (success){
                    var total_uat_tc = 0;
                    var total_uat_tc_pass = 0;

                    Ext.Array.each(records, function(user_story) {
                        total_uat_tc += user_story.get('TestCaseCount');
                        total_uat_tc_pass += user_story.get('PassingTestCaseCount');
                    });

                    var uat_tc_counts = {
                                        TotalUATTestCases: total_uat_tc,
                                        PassedUATTestCases: total_uat_tc_pass
                                    }
                    deferred.resolve(uat_tc_counts);

                } else {
                    //deferred.reject(Ext.String.format("Error getting {0} count for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });

        return deferred;
    },


                //TestCaseResult.TestCase.WorkProduct.ObjectID = Story.Object
                //TestCaseResult.TestCase.WorkProduct.Release.Name = “Relase XXX” AND TestCaseResult.TestCase.WorkProduct.Project = 123456

    _getTotalAttachments: function(record){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;
        console.log(me.release);

        var filters =   [
                            { property: 'Project.ObjectID', value: record.get('ObjectID')},
                            { property: 'Release.Name',value:me.release.rawValue}
                        ];

        Ext.create('Rally.data.wsapi.Store',{
            model: 'UserStory',
            fetch: ['ObjectID','TestCaseResult','TestCase','WorkProduct','Release','Project','Name'],
            filters: filters,
            scope:me
            // ,
            // limit: 1,
            // pageSize: 1
        }).load({
            callback: function(records, operation, success){
            if (success){
                var attach_promises = [];

                _.each(records, function(user_story){
                    var attach_filters =   [
                                                    { property: 'TestCaseResult.TestCase.WorkProduct.ObjectID', value: user_story.get('ObjectID')},
                                                ];
                    attach_promises.push(function(){
                        return me.fetchWsapiCount('Attachment',attach_filters); 
                    });
                },me);

                Deft.Chain.sequence(attach_promises).then({
                    success: function(results){
                        console.log('attachment out>>',results);
                        var total_attachments = 0;
                        _.each(results,function(result){
                            total_attachments += result;
                        });
                        deferred.resolve(total_attachments);
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


    // definition of executed: criteria :has a verdict, has attachment on the result, executed within the timebox, tied to a user story part of the release. 
    //
    //TODO: Executed within the timebox - should I look for release start and end date and see if LastRun is within the release range?

   _getTotalExecuted: function(record){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;
        console.log(me.release);

        var filters =   [
                            { property: 'Project.ObjectID', value: record.get('ObjectID')},
                            { property: 'Release.Name',value:me.release.rawValue}
                        ];

        Ext.create('Rally.data.wsapi.Store',{
            model: 'UserStory',
            fetch: ['ObjectID','TestCases'],
            filters: filters,
            scope:me
        }).load({
            callback: function(records, operation, success){
                if (success){

                Ext.Array.each(records, function(user_story) {
                    user_story.getCollection('TestCases').load({
                        fetch: ['ObjectID','Results'],
                        callback: function(records, operation, success) {
                           Ext.Array.each(records, function(test_case) {
                            if(test_case.LastVerdict!=null){
                                has_verdict = true;
                            }
                            test_case.getCollection('Results').load({
                                fetch: ['ObjectID', 'Attachments'],
                                callback: function(records, operation, success) {
                                    Ext.Array.each(records, function(test_case_result) {
                                        //has attachment
                                        if(0 < test_case_result.get('Attachments').Count){
                                            has_attachment = true;
                                        }
                                    });
                                },
                                scoope:me
                            });
                           });
                        },
                        scoope:me
                    });
                });
                
                deferred.resolve(total_attachments);


                } else {
                   // deferred.reject(Ext.String.format("Error getting {0} count for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
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
            columnCfgs: [
                {
                    text: 'PROJECT', 
                    dataIndex: 'ProjectName',
                    flex: 1
                },
                {
                        text: 'PO NAME', 
                        dataIndex: 'POorSMNames',
                        flex: 1,
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
                    text: 'PO ACCEPTED STORY %', 
                    dataIndex: 'TCCounts',
                    flex: 1,
                    renderer: function(TCCounts){
                        return TCCounts.USAcceptedByPO;
                    }


                },
                {
                        text: 'SM NAME', 
                        dataIndex: 'POorSMNames',
                        flex: 1,
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
                    text: 'SM RELEASED TO PROD USER STORY %', 
                    //dataIndex: 'Owner',
                    flex: 1

                },
                {
                    text: 'TOTAL TEST COUNT', 
                    dataIndex: 'TCCounts',
                    flex: 1,
                    renderer: function(TCCounts){
                        return TCCounts.TotalTestCases;
                    }

                },
                {
                    text: 'TOTAL TESTS EXECUTED', 
                    dataIndex: 'TotalTCExecuted',
                    flex: 1

                },
                {
                    text: 'NUMBER OF TESTS WITH RESULT ATTACHMENTS', 
                    dataIndex: 'TotalAttachments',
                    flex: 1

                },
                {
                    text: 'PASSED TESTS', 
                    dataIndex: 'TCCounts',
                    flex: 1,
                    renderer: function(TCCounts){
                        return TCCounts.PassedTestCases;
                    }

                },
                {
                    text: 'TOTAL UAT TESTS COUNT', 
                    dataIndex: 'UATTCCounts',
                    flex: 1,
                    renderer: function(UATTCCounts){
                        return UATTCCounts.TotalUATTestCases;
                    }

                },
                {
                    text: 'TOTAL UAT TESTS EXECUTED', 
                    dataIndex: 'TotalUATTCExecuted',
                    flex: 1

                },
                {
                    text: 'PASSED UAT TESTS', 
                    dataIndex: 'UATTCCounts',
                    flex: 1,
                    renderer: function(UATTCCounts){
                        return UATTCCounts.PassedUATTestCases;
                    }

                },
                {
                    text: 'TOTAL DEFECTS', 
                    dataIndex: 'TCCounts',
                    flex: 1,
                    renderer: function(TCCounts){
                        return TCCounts.TotalDefects;
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
