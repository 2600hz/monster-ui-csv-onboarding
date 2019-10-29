define(function (require) {
	var $ = require('jquery'),
	_ = require('lodash'),
	monster = require('monster'),
	Papa = require('papaparse');

	var app = {
		name: 'csv-onboarding',

		css: ['app'],

		i18n: {
			'en-US': { customCss: false },
			'fr-FR': { customCss: false }
		},

		appFlags: {
			csvOnboarding: {
				columns: {
					userMandatory: ['first_name', 'last_name', 'password', 'email', 'extension'],
					mandatory: ['first_name', 'last_name', 'password', 'email', 'extension', 'mac_address', 'brand', 'family', 'model']
				},
				users: {
					smartPBXCallflowString: ' SmartPBX\'s Callflow',
					smartPBXVMBoxString: '\'s VMBox'
				}
			}
		},

		// Defines API requests not included in the SDK
		requests: {},

		// Define the events available for other apps
		subscribe: {},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		load: function (callback) {
			var self = this;

			self.initApp(function () {
				callback && callback(self);
			});
		},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		initApp: function (callback) {
			var self = this;

			// Used to init the auth token and account id of this app
			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		// Entry Point of the app
		render: function (container) {
			var self = this;

			monster.ui.generateAppLayout(self, {
				menus: [
					{
						tabs: [
							{
								text: self.i18n.active().csvOnboarding.title,
								callback: self.csvOnboardingRender
							}
						]
					}
				]
			});
		},

		csvOnboardingRender: function (pArgs) {
			var self = this,
				args = pArgs || {},
				container = args.container || $('#csv_onboarding_app_container .app-content-wrapper'),
				mainTemplate = $(self.getTemplate({
					name: 'layout',
					data: {
						user: monster.apps.auth.currentUser
					}
				}));

			self.landingRender(mainTemplate);

			container
				.fadeOut(function () {
					$(this)
						.empty()
						.append(mainTemplate)
						.fadeIn();
				});
		},

		landingRender: function (container) {
			var self = this,
				template = $(self.getTemplate({ name: 'landing' }));

			self.bindLandingEvents(template);

			container.find('.content-wrapper')
				.fadeOut(function () {
					$(this)
						.empty()
						.append(template)
						.fadeIn();
				});
		},

		bindLandingEvents: function (template) {
			var self = this

			template.find('#users').on('click', function () {
				self.renderAddUsers();
			});

			template.find('#users_devices').on('click', function () {
				self.renderAddUsersDevices();
			});
		},

		renderAddUsers: function () {
			var self = this,
				template = $(self.getTemplate({ name: 'uploadUsers' }));

			self.bindAddUsersEvents(template);

			$('#csv_onboarding_app_container').find('.content-wrapper')
				.fadeOut(function () {
					$(this)
						.empty()
						.append(template)
						.fadeIn();
				});
		},

		bindAddUsersEvents: function (template, isDevices) {
			var self = this,
				file,

				handleFileSelect = function (evt) {
					file = evt.target.files[0];
					onFileSelected(file);
				},

				onFileSelected = function (file) {
					var isValid = file.name.match('.+(.csv)$');

					if (isValid) {
						template.find('.file-name').text(file.name);
						template.find('.selected-file').show();
						template.find('.upload-frame').hide();
						template.find('.start-job-action').removeAttr('disabled');
					} else {
						var text = self.getTemplate({
							name: '!' + self.i18n.active().csvOnboarding.uploads.errors.wrongType,
							data: {
								type: file.type
							}
						});

						monster.ui.alert('error', text);

						onInvalidFile();
					}
				},
				onInvalidFile = function () {
					file = undefined;
					template.find('.start-job-action').attr('disabled', 'disabled');
				},
				addJob = function () {
					if (file) {
						Papa.parse(file, {
							header: true,
							skipEmptyLines: true,
							complete: function (results) {
								var formattedData = {
									fileName: file.name,
									records: results.data,
									columns: {
										expected: {
											mandatory: isDevices? self.appFlags.csvOnboarding.columns.mandatory : self.appFlags.csvOnboarding.columns.userMandatory,
											optional: []
										},
										actual: results.meta.fields
									}
								};
								// console.log('formattedData',formattedData);
								self.renderReviewUsers(formattedData, isDevices);
							}
						});
					}
				};

			template.find('#back').on('click', function () {
				var container = $('#csv_onboarding_app_container .app-content-wrapper')
				self.landingRender(container);
			});
			//template.find('#upload_csv_file').change(handleFileSelect);
			template.find('#upload_csv_file').on('change', function (e) {
				handleFileSelect(e);
			});

			template.find('#proceed').on('click', function () {
				addJob();
			});

			template.find('.text-upload').on('click', function () {
				template.find('#upload_csv_file').trigger('click');
			});

			template.find('.undo-upload').on('click', function (e) {
				template.find('.file-name').text('');
				template.find('.selected-file').hide();
				template.find('.upload-frame').show();
				onInvalidFile();

				e.stopPropagation();
			});

			var container = template.find('.upload-frame').get(0);

			container.ondragover = function (e) {
				template.find('.upload-frame').addClass('hover');
				return false;
			};
			container.ondragleave = function (e) {
				template.find('.upload-frame').removeClass('hover');
				return false;
			};
			container.ondrop = function (e) {
				template.find('.upload-frame').removeClass('hover');
				e.preventDefault();

				file = e.dataTransfer.files[0];
				onFileSelected(file);
				return false;
			};
		},

		renderReviewUsers: function(data, isDevices) {
			var self = this,
				parent = $('#csv_onboarding_app_container'),
				templateData = self.prepareReviewData(data),
				template = $(self.getTemplate({
					name: 'reviewUsers',
					data: templateData
				}));

			self.bindReviewUsers(template, data, isDevices);

			parent.find('.content-wrapper')
					.empty()
					.append(template);
		},

		bindReviewUsers: function(template, data, isDevices) {
			var self = this,
				expectedColumns = data.columns.expected;

			monster.ui.footable(template.find('.footable'), {
				filtering: {
					enabled: false
				}
			});

			template.find('#proceed').on('click', function() {
				var columnsMatching = self.getColumnsMatching(template),
					resultCheck = self.checkValidColumns(columnsMatching, expectedColumns, data);

				if (resultCheck.isValid) {
					var formattedData = self.formatTaskData(columnsMatching, data),
						hasCustomizations = template.find('.has-customizations').prop('checked');
					// console.log(formattedData);
					if (hasCustomizations) {
						self.renderCustomizations(formattedData.data, function(customizations) {
							self.startProcess(formattedData.data, customizations, isDevices);
						});
					} else {
						self.startProcess(formattedData.data, {}, isDevices);
					}
				} else {
					var msg = self.i18n.active().csvOnboarding.review.errors.title + '<br/><br/>';

					_.each(resultCheck.errors, function(v, category) {
						_.each(v, function(column) {
							msg += '<strong>'+ column + '</strong> : ' + self.i18n.active().csvOnboarding.review.errors[category] + '<br/>';
						});
					});

					monster.ui.alert('error', msg);
				}
			});

			template.find('#cancel').on('click', function() {
				self.csvOnboardingRender();
			});
		},

		renderAddUsersDevices: function () {
			var self = this,
				template = $(self.getTemplate({ name: 'uploadUsersDevices' }));

			self.bindAddUsersEvents(template,true);

			$('#csv_onboarding_app_container').find('.content-wrapper')
				.fadeOut(function () {
					$(this)
						.empty()
						.append(template)
						.fadeIn();
				});
		},

		startProcess: function(data, customizations, isDevices) {
			var self = this,
				template = $(self.getTemplate({
					name: 'progress',
					data: {
						totalRequests: data.length
					}
				})), successRequests= 0;
			var listUserCreate = [];

			$('#csv_onboarding_app_container').find('.content-wrapper')
					.empty()
					.append(template);

			// if(isDevices){ // users and devices
				// console.log('only users and devices', data);
				// if(data.length > 0){
				// 	_.each(data, function(userData) {
				// 		var newData = self.formatUserData(userData, customizations);

				// 	});
				// }

			// }else{ //only users
			// console.log('only users', data);

			if (data.length > 0) {
				_.each(data, function (userData) {
					var newData = self.formatUserData(userData, customizations);
					// console.log('user', newData);
					if (isDevices) { // users and devices
						listUserCreate.push(function (callback) {
							self.createUserDevices(newData,
								function (sdata) { // on success
									if(sdata.user){
										successRequests = successRequests + 1;
									}
									// console.log('X SUCCESS',sdata)
									var percentFilled = Math.ceil((successRequests / data.length) * 100);
									template.find('.count-requests-done').html(successRequests);
									template.find('.count-requests-total').html(data.length);
									template.find('.inner-progress-bar').attr('style', 'width: ' + percentFilled + '%');
									callback(null, sdata);
								},
								function (parsedError, ) { // on error
									// console.log('X ERROR', parsedError)
									callback(null, parsedError);
								})
						});
					} else {
						listUserCreate.push(function (callback) {
							self.createUser(newData.user,
								function (sdata) { // on success
									successRequests = successRequests + 1;
									// console.log('sucess',sdata)
									var percentFilled = Math.ceil((successRequests / data.length) * 100);
									template.find('.count-requests-done').html(successRequests);
									template.find('.count-requests-total').html(data.length);
									template.find('.inner-progress-bar').attr('style', 'width: ' + percentFilled + '%');
									callback(null, sdata);
								},
								function (parsedError) { // on error
									// console.log('log error', self.template, template)
									callback(null, parsedError);
								})
						});
					}
				});
				monster.parallel(listUserCreate, function (err, results) {
					// console.log('parallel results', results);
					// console.log('errs', results.filter(x => x.status === "error"));
					// console.log('success',results.filter(x => x.status === 'success'));

					// status: "success"
					var tmpData = {
						count: isDevices? results.filter(x => x.user).length : results.filter(x => x.status === "success").length,
						deviceCount: isDevices? results.filter(x => x.device).length : 0,
						account: monster.apps.auth.currentAccount.name,
						isDevices: isDevices
					}
					self.showResults(tmpData);

					// show error dialog for errors
					var tmpErrs=[];
					if(isDevices){

						_.each(results, function(o) {
							if(o.err && o.err.status === "error"){
								tmpErrs.push(o.err); 
							}
						}); 
						  
					
					}else{
						 tmpErrs = results.filter(x => x.status === "error");
					}
					// console.log(tmpErrs);
					varErrMsg = '';
					_.each(tmpErrs, function (item) {
						if (item && item.error === '400'){
								if(item.data.username && item.data.username.unique) {
									varErrMsg += "<strong>" + item.data.username.unique.cause + "</strong> Email is not unique for this account. <br/>";
								}
								if(item.data.mailbox && item.data.mailbox.unique){
									varErrMsg += "<strong>" + item.data.mailbox.unique.cause + "</strong> Extension is not unique for this account. <br/>";
								}
								if(item.data.mac_address && item.data.mac_address.unique){
									varErrMsg += "<strong>" + item.data.mac_address.unique.cause + "</strong> Mac Address is not unique for this account. <br/>";
								}
						} else {
							varErrMsg += "<strong>" + item.error + "</strong>" + item.message + ". <br/>";
						}
					})
					monster.ui.alert('error', varErrMsg);
				})
			}
			// }
		},

		showResults: function(tmpData){
			
			var self = this,
			template = $(self.getTemplate({
				name: 'results',
				data: tmpData
			}))

			$('#csv_onboarding_app_container').find('.content-wrapper')
			.empty()
			.append(template);

			template.find('#back').on('click', function () {
				var container = $('#csv_onboarding_app_container .app-content-wrapper')
				self.landingRender(container);
			});

		},

		renderCustomizations: function(data, onContinue) {
			var self = this,
				parent = $('#csv_onboarding_app_container'),
				template = $(self.getTemplate({
					name: 'customizations'
				})),
				getJson = function(str) {
					try {
						return JSON.parse(str);
					} catch (e) {
						return {};
					}
				};

			template.find('textarea').on('keyup', function() {
				var $this = $(this),
					val = $this.val(),
					jsonValue = getJson(val);

				if (!_.isEmpty(jsonValue)) {
					$this.siblings('.json-result').empty();
					monster.ui.renderJSON(jsonValue, $this.siblings('.json-result'));
				}
			});

			template.find('.continue').on('click', function() {
				var customizations = {
					user: getJson(template.find('textarea[data-type="user"]').val()),
					device: getJson(template.find('textarea[data-type="device"]').val()),
					vmbox: getJson(template.find('textarea[data-type="vmbox"]').val())
				};

				onContinue && onContinue(customizations);
			});

			parent.find('.content-wrapper')
					.empty()
					.append(template);
		},

// utility fn

		createUserDevices: function(data, callback, callbackErr) {
			// console.log('createUserDevices',data);
			var self = this;
			var resultData = {};
			monster.waterfall([
				function(waterfallCallback) {
					// console.log('task1 createUser');
					self.createUser(data.user, 
						function(udata){ // on success
							// console.log('task1 success', udata);
							// console.log("INPUT",data);
							var userId = udata.data.id;
							data.user.id = userId;
							data.vmbox.owner_id = userId;
							data.device.owner_id = userId;
							resultData.user = udata.data;
							waterfallCallback(null, udata);
						},
						function(parsedError){ // on error
							// console.log('task1 error');
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
					})
				},
				function( _data, waterfallCallback) {
					// console.log('task2 createVMBox',_data, data.vmbox);
					self.createVMBox(data.vmbox, 
						function(vmdata){ // on success
							// console.log('task2 success', vmdata);
							resultData.vmbox = vmdata;
							data.callflow.flow.children._.data.id = vmdata.id;
							waterfallCallback(null, vmdata);
						},
						function(parsedError){ // on error
							// console.log('task2 error');
							parsedError.data.mailbox.unique.cause = data.vmbox.mailbox
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
					})
				},
				function(_data, waterfallCallback) {
					// console.log('task3 createDevices', _data);
					self.createDevice(data.device, 
						function(devicedata){ // on success
							resultData.device = devicedata;
							// console.log('task3 success', devicedata);
							waterfallCallback(null, devicedata);
						},
						function(parsedError){ // on error
							// console.log('task3 error');
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
					})
				},
				function( _data, waterfallCallback) {
					// console.log('task4 createDevices', _data);
					
					data.callflow.owner_id = data.user.id;
					data.callflow.type = 'mainUserCallflow';
					data.callflow.flow.data.id = data.user.id;
					// data.callflow.flow.children._.data.id = results.vmbox.id;
					
					self.createCallflow(data.callflow, 
						function(cfdata){ // on success
							resultData.callflow  = cfdata;
							// console.log('task4 success', cfdata);
							waterfallCallback(null, cfdata);
						},
						function(parsedError){ // on error
							// console.log('task4 error');
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
					})
				}
			], function(err, result) {
				// console.log('isErr',err);
				// console.log('result',result);
				if(err){
					callbackErr && callbackErr(resultData);
				}else{
					callback && callback(resultData);
				}

			});
		},


		createUser: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'user.create',
				acceptCharges: true,
				data: {
					accountId: self.accountId,
					data: data,
					generateError: false
				},
				success: function(data, status) {
					callback && callback(data);
				},
				error: function(parsedError){
					err && err(parsedError);
				}
			});
		},



		createVMBox: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				acceptCharges: true,
				data: {
					accountId: self.accountId,
					data: data,
					generateError: false
				},
				success: function(data) {
					callback(data.data);
				},
				error: function(parsedError){
					err && err(parsedError);
				}
			});
		},

		createCallflow: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'callflow.create',
				acceptCharges: true,
				data: {
					accountId: self.accountId,
					data: data,
					generateError: false
				},
				success: function(data) {
					callback(data.data);
				},
				error: function(parsedError){
					err && err(parsedError);
				}
			});
		},

		createDevice: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'device.create',
				acceptCharges: true,
				data: {
					accountId: self.accountId,
					data: data,
					generateError: false
				},
				success: function(data) {
					callback(data.data);
				},
				error: function(parsedError){
					err && err(parsedError);
				}
			});
		},

		formatTaskData: function(columnsMatching, data) {
			var self = this,
				formattedRecords = [],
				formattedElement,
				formattedData = {
					fileName: data.fileName
				};

			_.each(data.records, function(record) {
				formattedElement = {};

				_.each(columnsMatching, function(backendColumn, frontendColumn) {
					if (backendColumn !== '_none') {
						formattedElement[backendColumn] = record[frontendColumn];
					}
				});

				formattedRecords.push(formattedElement);
			});

			formattedData.data = formattedRecords;

			return formattedData;
		},		

		getColumnsMatching: function(template) {
			var self = this,
				mappings = {},
				$this;

			template.find('.review-table-wrapper tr.footable-header th.column-data').each(function() {
				$this = $(this);
				mappings[$this.data('column')] = $this.find('.column-selector').val();
			});

			return mappings;
		},

		checkValidColumns: function(columns, requiredColumns, data) {
			var self = this,
				mapColumns = {
					mandatory: {},
					optional: {}
				},
				isValid = true,
				errors = {
					missing: [],
					tooMany: [],
					uniqEmail: [],
					uniqExtension: [],
					uniqMac: []
				};

			_.each(requiredColumns, function(category, categoryName) {
				mapColumns[categoryName] = {};

				_.each(category, function(column) {
					mapColumns[categoryName][column] = 0;
				});
			});

			_.each(columns, function(column) {
				if (mapColumns.mandatory.hasOwnProperty(column)) {
					mapColumns.mandatory[column]++;
				}

				if (mapColumns.optional.hasOwnProperty(column)) {
					mapColumns.optional[column]++;
				}
			});

			_.each(mapColumns.mandatory, function(count, column) {
				if (count !== 1) {
					errors[count === 0 ? 'missing' : 'tooMany'].push(column);

					isValid = false;
				}
			});

			_.each(mapColumns.optional, function(count, column) {
				if (count > 1) {
					errors.tooMany.push(column);

					isValid = false;
				}
			});

			// check if duplicate email 
			if( _.uniqBy(data.records, 'email').length !== data.records.length){
				errors.uniqEmail = _.keys(_.pickBy(_.groupBy(data.records, 'email'), x => x.length > 1));
				isValid = false;
			}
			
			// check if duplicate extension 
			if( _.uniqBy(data.records, 'extension').length !== data.records.length){
				errors.uniqExtension =  _.keys(_.pickBy(_.groupBy(data.records, 'extension'), x => x.length > 1));
				isValid = false;
			}
			
			// check if duplicate mac_address 
			if( _.uniqBy(data.records, 'mac_address').length !== data.records.length){
				errors.uniqMac =  _.keys(_.pickBy(_.groupBy(data.records, 'mac_address'), x => x.length > 1));
				isValid = false;
			}

			return {
				isValid: isValid,
				errors: errors
			};
		},

		prepareReviewData: function(data) {
			var formattedData = {
				data: {
					fileName: data.fileName,
					totalRecords: data.records.length,
					columns: {
						actual: data.columns.actual,
						expected: data.columns.expected
					},
					recordsToReview: data.records.slice(0, 5)
				}
			};

			// remove extra data not parsed properly
			_.each(formattedData.data.recordsToReview, function(record) {
				delete record.__parsed_extra;
			});

			formattedData.data.columns.others = [];

			var occurences;

			// for each column in the csv, we check if it's one of the column mandatory or optional in that job.
			// If not, then we add it to the list of 'Others' columns to choose from
			// This was added so users can submit their extra column they need to keep in the database, such as billing ids etc...
			_.each(data.columns.actual, function(actualColumnName) {
				occurences = 0;
				_.each(data.columns.expected, function(expectedColumnGrp) {
					if (expectedColumnGrp && expectedColumnGrp.indexOf(actualColumnName) >= 0) {
						occurences++;
					}
				});

				if (occurences === 0 && formattedData.data.columns.others.indexOf(actualColumnName) < 0) {
					formattedData.data.columns.others.push(actualColumnName);
				}
			});

			return formattedData;
		},

		formatUserData: function(data, customizations) {
			var self = this,
				fullName = data.first_name + ' ' + data.last_name,
				callerIdName = fullName.substring(0, 15),
				formattedData = {
					rawData: data,
					user: $.extend(true, {}, customizations.user, {
						first_name: data.first_name,
						last_name: data.last_name,
						password: data.password,
						username: data.email,
						caller_id: {
							internal: {
								name: callerIdName,
								number: data.extension
							}
						},
						presence_id: data.extension,
						email: data.email
					}),
					device: $.extend(true, {}, customizations.device, {
						device_type: 'sip_device',
						enabled: true,
						mac_address: data.mac_address,
						name: data.first_name + ' ' + data.last_name + ' - ' + data.brand + ' ' + data.model,
						provision: {
							endpoint_brand: data.brand,
							endpoint_family: data.family,
							endpoint_model: data.model
						},
						sip: {
							password: monster.util.randomString(12),
							username: 'user_' + monster.util.randomString(10)
						}
					}),
					vmbox: $.extend(true, {}, customizations.vmbox, {
						mailbox: data.extension,
						name: fullName + self.appFlags.csvOnboarding.users.smartPBXVMBoxString
					}),
					callflow: {
						contact_list: {
							exclude: false
						},
						flow: {
							children: {
								_: {
									children: {},
									data: {},
									module: 'voicemail'
								}
							},
							data: {
								can_call_self: false,
								timeout: 20
							},
							module: 'user'
						},
						name: fullName + self.appFlags.csvOnboarding.users.smartPBXCallflowString,
						numbers: [ data.extension ]
					}
				};

			return formattedData;
		}

	};

	return app;
});
