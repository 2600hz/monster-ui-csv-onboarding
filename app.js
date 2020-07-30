define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		Papa = require('papaparse');

	var app = {
		css: ['app'],

		i18n: {
			'de-DE': { customCss: false },
			'en-US': { customCss: false }
		},

		appFlags: {
			csvOnboarding: {
				columns: {
					mandatory: ['first_name', 'last_name', 'password', 'email', 'extension'],
					optional: ['phone_number', 'mac_address', 'brand', 'family', 'model', 'softphone']
				},
				users: {
					smartPBXCallflowString: ' SmartPBX\'s Callflow',
					smartPBXVMBoxString: '\'s VMBox'
				}
			}
		},

		requests: {
			/* Provisioner */
			'common.chooseModel.getProvisionerData': {
				apiRoot: monster.config.api.provisioner,
				url: 'phones',
				verb: 'GET'
			},
			/* Device iteration for feature keys */
			'data.template.feature_keys.iteration': {
				apiRoot: 'https://z.stg.audian.com/',
				url: '/ui/{brand}/{family}/{model}',
				verb: 'GET',
				generateError: false,
				removeHeaders: [
					'X-Kazoo-Cluster-ID',
					'X-Auth-Token',
					'Content-Type'
				]
			}
		},

		subscribe: {},

		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		// Entry Point of the app
		render: function(container) {
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

		csvOnboardingRender: function(pArgs) {
			var self = this,
				args = pArgs || {},
				container = args.container || $('#csv_onboarding_app_container .app-content-wrapper'),
				mainTemplate = $(self.getTemplate({ name: 'layout' }));
			self.uploadsRender(mainTemplate);

			container
				.fadeOut(function() {
					$(this)
						.empty()
						.append(mainTemplate)
						.fadeIn();
				});
		},

		uploadsRender: function(container) {
			var self = this,
				template = $(self.getTemplate({ name: 'upload' }));

			self.bindUploadEvents(template);

			container.find('.content-wrapper')
				.empty()
				.append(template);
		},

		bindUploadEvents: function(template) {
			var self = this,
				file,
				handleFileSelect = function(evt) {
					file = evt.target.files[0];
					onFileSelected(file);
				},
				onFileSelected = function(file) {
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
				onInvalidFile = function() {
					file = undefined;
					template.find('.start-job-action').attr('disabled', 'disabled');
				},
				addJob = function() {
					if (file) {
						Papa.parse(file, {
							header: true,
							skipEmptyLines: true,
							complete: function(results) {
								var formattedData = {
									fileName: file.name,
									records: results.data,
									columns: {
										expected: {
											mandatory: self.appFlags.csvOnboarding.columns.mandatory,
											optional: self.appFlags.csvOnboarding.columns.optional
										},
										actual: results.meta.fields
									}
								};

								self.renderReview(formattedData);
							}
						});
					}
				};

			//template.find('#upload_csv_file').change(handleFileSelect);
			template.find('#upload_csv_file').on('change', function(e) {
				handleFileSelect(e);
			});

			template.find('#proceed').on('click', function() {
				addJob();
			});

			template.find('.text-upload').on('click', function() {
				template.find('#upload_csv_file').trigger('click');
			});

			template.find('.undo-upload').on('click', function(e) {
				template.find('.file-name').text('');
				template.find('.selected-file').hide();
				template.find('.upload-frame').show();
				onInvalidFile();

				e.stopPropagation();
			});

			var container = template.find('.upload-frame').get(0);

			container.ondragover = function(e) {
				template.find('.upload-frame').addClass('hover');
				return false;
			};
			container.ondragleave = function(e) {
				template.find('.upload-frame').removeClass('hover');
				return false;
			};
			container.ondrop = function(e) {
				template.find('.upload-frame').removeClass('hover');
				e.preventDefault();

				file = e.dataTransfer.files[0];
				onFileSelected(file);
				return false;
			};
		},

		renderReview: function(data) {
			var self = this,
				parent = $('#csv_onboarding_app_container'),
				templateData,
				template;

			self.getNumberList(function(numList) {
				data.numbers = numList;

				templateData = self.prepareReviewData(data);
				template = $(self.getTemplate({
					name: 'review',
					data: templateData
				}));

				self.bindReview(template, data);

				parent.find('.content-wrapper')
					.empty()
					.append(template);
			});
		},

		getNumberList: function(callback) {
			var self = this,
				numbersList = [];

			self.callApi({
				resource: 'numbers.list',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					if (data.page_size > 0) {
						_.each(data.data.numbers, function(num, key) {
							if (num.hasOwnProperty('used_by') === false) {
								numbersList.push(key.slice(1));
							}
						});
					}

					callback(numbersList);
				}
			});
		},

		bindReview: function(template, data) {
			var self = this,
				expectedColumns = data.columns.expected;

			monster.ui.footable(template.find('.footable'), {
				filtering: {
					enabled: false
				}
			});

			monster.request({
				resource: 'common.chooseModel.getProvisionerData',
				data: {},
				success: function(dataProvisioner) {
					self.findDeviceBrand(data, dataProvisioner, template);
				}
			});

			template.find('#proceed').on('click', function() {
				var columnsMatching = self.getColumnsMatching(template),
					resultCheck = self.checkValidColumns(columnsMatching, expectedColumns);

				if (resultCheck.isValid) {
					var formattedData = self.formatTaskData(columnsMatching, data),
						hasCustomizations = template.find('.has-customizations').prop('checked'),
						numValidation = self.checkNumberValidation(data.numbers, formattedData.data);

					// If the number validation is true then start the process.
					if (numValidation.isValid) {
						if (hasCustomizations) {
							self.renderCustomizations(formattedData.data, function(customizations) {
								self.startProcess(formattedData.data, customizations);
							});
						} else {
							self.startProcess(formattedData.data, {});
						}
					// If the number validation is FALSE then generate the error message for the user.
					} else {
						var msg = 'The lines listed below could not be assigned to the number set in the phone numbers column. Either the number is a duplicate on the CSV or is not an available number on your account.<br/><br/>Please remove the number from the row and try to upload again.<br/>';

						_.each(numValidation.errors, function(error) {
							msg += error.name + ' on line ' + error.row + ' with the number ' + error.number + '<br/>';
						});

						monster.ui.alert('error', msg);
					}
				} else {
					var msg = self.i18n.active().csvOnboarding.review.errors.title + '<br/><br/>';

					_.each(resultCheck.errors, function(v, category) {
						_.each(v, function(column) {
							msg += column + ': ' + self.i18n.active().csvOnboarding.review.errors[category] + '<br/>';
						});
					});

					monster.ui.alert('error', msg);
				}
			});

			template.find('#cancel').on('click', function() {
				self.csvOnboardingRender();
			});
		},

		// Check if the numbers listed on the CSV are valid otherwise create a list of rows with errors.
		checkNumberValidation: function(numbers, rowData) {
			var validation = {
				isValid: true,
				errors: []
			};

			// Check each row for phone numbers.
			_.each(rowData, function(row, rowIndex) {
				// If the row has a number and is not equal to none then get the index of the number = to the rows number in the numbers list.
				if (row.hasOwnProperty('phone_number') && (row.phone_number !== 'none' && row.phone_number !== '')) {
					var rowNumber = row.phone_number.replace(/[-+\s]/g, ''), //Removes -, +, and whitespace from the number.
						index = _.indexOf(numbers, rowNumber);

					// If the index is found (not -1) then remove that number from the list of numbers.
					if (index !== -1) {
						numbers = _.filter(numbers, function(num) {
							return num !== rowNumber;
						});
					// If the number is not in the list then create an object with the error info in it.
					} else {
						var errorData = {
							name: row.first_name + ' ' + row.last_name,
							row: rowIndex + 2,
							number: rowNumber
						};

						validation.isValid = false;
						validation.errors.push(errorData);
					}
				}
			});

			return validation;
		},

		findDeviceBrand: function(redcordData, provisionerData, template) {
			var self = this,
				deviceBrand = {};
			_.each(redcordData.records, function(record) {
				record.brand = record.brand.toLowerCase();

				if (record.brand.length && record.brand !== 'none') {
					deviceBrand = _.find(provisionerData.data, function(brand) { //Returns the device brand if it is a match.
						brand.id === record.brand ? record.provision = true : record.provision = false; //Sets the provision status to true or false.
						return brand.id === record.brand; //If there is a match it will return that brand.
					});

					if (record.provision === true) { //Verifies if the device is valid
						self.findDeviceFamily(record, deviceBrand, template); //Calls the next function to verify the family.
					} else {
						record.provision === false ? self.deviceInvalid(record, template, 'brand') : self.deviceInvalid(record, template, 'MAC Address'); //Otherwise throws an error.
					}
				}
			});
		},

		deviceInvalid: function(data, template, errorMessage) {
			var self = this;

			var text = self.getTemplate({
				name: '!' + self.i18n.active().csvOnboarding.uploads.errors.message,
				data: {
					fName: data.first_name,
					lName: data.last_name,
					error: errorMessage
				}
			});
			monster.ui.alert('error', text);

			template.find('#proceed').attr('disabled', 'disabled');
		},

		findDeviceFamily: function(record, brand, template) {
			var self = this,
				deviceFamily = {},
				familyError = 'family';

			deviceFamily = _.find(brand.families, function(family) {
				record.family = record.family.toLowerCase();
				family.name === record.family ? record.provision = true : record.provision = false; //Sets the status to true or false.
				return family.name === record.family;
			});

			if (record.provision === true) {
				self.findDeviceModel(record, deviceFamily, template);
			} else {
				self.deviceInvalid(record, template, familyError);
			}
		},

		findDeviceModel: function(record, family, template) {
			var self = this,
				modelError = 'model';
			var models = Object.getOwnPropertyNames(family.models);

			_.find(models, function(model) {
				model === record.model ? record.provision = true : record.provision = false; //Sets the status to true or false.
				return model === record.model;
			});

			if (record.provision === false) {
				self.deviceInvalid(record, template, modelError);
			}
		},

		createSmartPBXData: function(formattedData, customizations, onProgress) {
			var self = this,
				parallelRequests = [],
				totalRequests,
				countFinishedRequests = 0,
				dataProgress;

			self.usersGetMainDirectory(function(directory) {
				var directory = {
					directories: directory.id
				};

				_.each(formattedData, function(record) {
					_.extend(record, directory);
					parallelRequests.push(function(callback) {
						var data = self.formatUserData(record, customizations);

						self.createSmartPBXUser(data, function(dataUser) {
							dataProgress = {
								countFinishedRequests: countFinishedRequests++,
								totalRequests: totalRequests
							};
							onProgress(dataUser, dataProgress);

							callback && callback(null, dataUser);
						});
					});
				});

				totalRequests = parallelRequests.length;

				monster.parallel(parallelRequests, function(err, results) {
					self.showResults(results);
				});
			});
		},

		startProcess: function(data, customizations) {
			var self = this,
				template = $(self.getTemplate({
					name: 'progress',
					data: {
						totalRequests: data.length
					}
				}));

			$('#csv_onboarding_app_container').find('.content-wrapper')
				.empty()
				.append(template);

			self.createSmartPBXData(data, customizations, function(user, progress) {
				var percentFilled = Math.ceil((progress.countFinishedRequests / progress.totalRequests) * 100);
				template.find('.count-requests-done').html(progress.countFinishedRequests);
				template.find('.count-requests-total').html(progress.totalRequests);
				template.find('.inner-progress-bar').attr('style', 'width: ' + percentFilled + '%');
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

		showResults: function(results) {
			var self = this;
			/*var self = this,
				parent = $('#csv_onboarding_app_container'),
				template = $(self.getTemplate({
					name: 'results',
					data: results
				}));

			monster.ui.footable(template.find('.footable'));

			parent.find('.content-wrapper')
					.empty()
					.append(template);*/

			/*{
				provision: {
					combo_keys: {
						0: {type: "line"},
						1: {type: "parking", value: "1"},
						2: {type: "parking", value: "2"}
					}
				}
			}*/
			monster.ui.toast({
				type: 'success',
				message: 'Congratulations, you successfully imported data to this account!'
			});

			var featureKeyDevices = {
				status: false,
				data: []
			};

			_.each(results, function(result) {
				if (result.device !== undefined) {
					featureKeyDevices.data.push(result);
					featureKeyDevices.status = true;
				}
			});

			if (featureKeyDevices.status === true) {
				self.renderFeatureKeys(featureKeyDevices);
			} else {
				self.csvOnboardingRender();
			}
		},

		renderFeatureKeys: function(newUsers) {
			var self = this,
				totalKeys = 12,
				featureKeys = [],
				keyTypes = {
					none: 'None',
					presence: 'Presence',
					parking: 'Parking',
					personal_parking: 'Personal Parking',
					speed_dial: 'Speed Dial'
				},
				userList = {},
				parkingSpots = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

			for (var i = 0; i < totalKeys; i++) {
				var FeatuerKeyTemplate = {
					index: 0
				};

				FeatuerKeyTemplate.index = i + 1;
				featureKeys.push(FeatuerKeyTemplate);
			}

			self.getUsers(function(userData) {
				userList = userData;

				var parent = $('#csv_onboarding_app_container'),
					template = $(self.getTemplate({
						name: 'feature-keys',
						data: {
							data: {
								featureKeys: featureKeys,
								keyTypes: keyTypes,
								userList: userList,
								parkingSpots: parkingSpots
							}
						}
					}));

				parent.find('.content-wrapper')
					.empty()
					.append(template);

				template.find('.feature-key-type').on('change', function(event) {
					var type = $(this).val(),
						numberPattern = /[1-9][0-2]|[1-9]/g,
						rowIndex = $(this).attr('name').match(numberPattern), //The index value for the type.
						keyTypeValue = event.target.value, //The type value. The type values are feature key options like Park or Speed Dial.
						keyValue = '', //The default value for each key value. The key value is the data for each type such as Park(type) 1(key value).
						speedDial = {
							name: '',
							number: ''
						};

					$(this).siblings('.feature-key-value').addClass('hidden'); //Hide all key values on render.
					$(this).siblings('.feature-key-type.active').removeClass('active'); //Remove the current active type.
					$(this).addClass('active'); //Activate the type (None, Presence, Park, ect)
					$(this).siblings('.feature-key-value[data-type="' + type + '"]').addClass('active'); //Activate the value of the type.
					$(this).siblings('.feature-key-value[data-type="' + type + '"]').removeClass('hidden');//Show the type

					if (type === 'none' && featureKeys[rowIndex - 1].type !== undefined) { //Catches types set to none and leaves them empty.
						$(this).siblings('.feature-key-value').addClass('hidden');

						delete featureKeys[rowIndex - 1].type;
						delete featureKeys[rowIndex - 1].value;
					} else {
						featureKeys[rowIndex - 1].type = keyTypeValue; //Stores the type value in the data storage object.

						keyValue = $(this).siblings('.feature-key-value.active')[0].lastElementChild.value; //Gets the type key value.
						featureKeys[rowIndex - 1].value = keyValue; //Stores the default type key value in the data storage object. (First value in the list)
					}

					template.find('.feature-key-value').off().on('change', function(event) {
						if (event.target.className === 'type') {
							var valueRowIndex = $(this).find('.type').attr('name').match(numberPattern); //Gets the index value for the key value.
							featureKeys[valueRowIndex - 1].value = event.target.value;
						}

						if (event.target.parentNode.dataset.type === 'speed_dial') {
							if (event.target.className === 'sdName') {
								speedDial.name = event.target.value;
							}

							if (event.target.className === 'sdNumber') {
								var valueRowIndex = $(this).find('.sdNumber').attr('name').match(numberPattern); //Gets the index value for the key value.
								speedDial.number = monster.util.unformatPhoneNumber(event.target.value);

								speedDial.name === '' ? featureKeys[valueRowIndex - 1].value = speedDial.number + ':' + speedDial.number : featureKeys[valueRowIndex - 1].value = speedDial.name + ':' + speedDial.number;
							}
						}
					});
					$(this).siblings('.feature-key-value.active').removeClass('active'); //Remove the active status for this item.
				});

				template.find('#proceed').on('click', function() {
					self.getDeviceFeatureKeyTotal(newUsers, featureKeys);

					self.csvOnboardingRender();
				});

				template.find('#cancel').on('click', function() {
					self.csvOnboardingRender();
				});
			});
		},

		getDeviceFeatureKeyTotal: function(newUsers, featureKeys) {
			var self = this,
				appData = {
					deviceList: [],
					users: newUsers.data,
					featureKeys: featureKeys
				};

			_.each(appData.users, function(user) {
				var device = {
					brand: user.device.provision.endpoint_brand,
					family: user.device.provision.endpoint_family,
					model: user.device.provision.endpoint_model
				};

				//Check if the device info is in the list if not add it
				if (!_.find(appData.deviceList, { model: device.model })) {
					appData.deviceList.push(device);
				}
			});
			//Make the API calls to get the number of feature keys allowed on a device.
			self.getDeviceItteration(appData);
		},

		getDeviceItteration: function(appData) {
			var self = this;

			_.each(appData.deviceList, function(device) {
				monster.request({
					resource: 'data.template.feature_keys.iteration',
					data: {
						brand: device.brand,
						family: device.family,
						model: device.model
					},
					success: function(apiData, status) {
						device.keys = apiData.data.template.feature_keys.iterate;
						self.updateDeviceKeys(appData, device);
					}
				});
			});
		},

		updateDeviceKeys: function(appData, currentDevice) {
			var self = this;

			//Get the device id and device model for each user.
			_.each(appData.users, function(user) {
				var userModel = user.device.provision.endpoint_model,
					userDeviceMaxKeys = 0;

				if (currentDevice.model === userModel) {
					userDeviceMaxKeys = currentDevice.keys;

					if (userDeviceMaxKeys < appData.featureKeys.length && userDeviceMaxKeys !== 0) {
						var slicedFeatureKeys = appData.featureKeys.slice(0, userDeviceMaxKeys),
							formattedKeys = {};

						_.each(slicedFeatureKeys, function(line, key) {
							if (line.type) {
								delete line.index;
								formattedKeys[key] = line;
							}
						});

						user.device.provision.feature_keys = formattedKeys; //Add the formated feature keys to the data structure.
						self.updateDevice(user);
					} else if (userDeviceMaxKeys >= appData.featureKeys.length) {
						var slicedFeatureKeys = appData.featureKeys.slice(0),
							formattedKeys = {};

						_.each(slicedFeatureKeys, function(line, key) {
							if (line.type) {
								delete line.index;
								formattedKeys[key] = line;
							}
						});

						user.device.provision.feature_keys = formattedKeys; //Add the formated feature keys to the data structure.
						self.updateDevice(user);
					}
				}
			});
		},

		updateDevice: function(data) {
			var self = this;

			self.callApi({
				resource: 'device.update',
				data: {
					accountId: self.accountId,
					data: data.device,
					deviceId: data.device.id
				},
				error: function(data) {
					monster.ui.alert('error', 'The feature keys were not applied to the new users.');
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

		checkValidColumns: function(columns, requiredColumns) {
			var self = this,
				mapColumns = {
					mandatory: {},
					optional: {}
				},
				isValid = true,
				errors = {
					missing: [],
					tooMany: []
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

		createSmartPBXUser: function(data, success, error) {
			var self = this,
				formattedResult = {
					device: {},
					user: {},
					vmbox: {},
					callflow: {}
				};

			self.callApi({
				resource: 'user.create',
				data: {
					accountId: self.accountId,
					data: data.user
				},
				success: function(_dataUser) {
					formattedResult.user = _dataUser.data;

					var userId = _dataUser.data.id;
					data.user.id = userId;
					data.vmbox.owner_id = userId;
					data.device.owner_id = userId;
					monster.parallel({
						vmbox: function(callback) {
							self.createVMBox(data.vmbox, function(_dataVM) {
								callback(null, _dataVM);
							});
						},
						device: function(callback) {
							if (data.rawData.brand && data.rawData.brand !== 'none') { //Detects if there is a valid device.
								self.createDevice(data.device, function(_dataDevice) { //Create device
									callback(null, _dataDevice);
								});
							} else {
								callback(null); //Otherwise do not create a device.
							}
						},
						softphone: function(callback) {
							if (data.rawData.softphone === 'yes') { //Detects if the user needs a softphone
								self.createSoftPhone(data.user, function(_dataSoftPhone) { //Create softphone
									callback(null, _dataSoftPhone);
								});
							} else {
								callback(null); //Otherwise do not create a softphone.
							}
						}
					}, function(err, results) {
						formattedResult.vmbox = results.vmbox;
						formattedResult.device = results.device;
						formattedResult.softphone = results.softphone;

						data.callflow.owner_id = userId;
						data.callflow.type = 'mainUserCallflow';
						data.callflow.flow.data.id = userId;
						data.callflow.flow.children._.data.id = results.vmbox.id;

						if (data.rawData.phone_number !== 'none' && !_.isEmpty(data.rawData.phone_number)) {
							data.callflow.numbers.push(data.rawData.phone_number);
						}

						self.createCallflow(data.callflow, function(_dataCF) {
							var dirConstructor = {
									directories: {}
								},
								dirID = {};

							formattedResult.callflow = _dataCF;
							dirID[data.rawData.directories] = _dataCF.id; //directory id: callflow id
							formattedResult.directories = dirID;

							$.extend(dirConstructor.directories, dirID);
							$.extend(data.user, dirConstructor);
							
							self.usersUpdateUser(data.user);
							success(formattedResult);
						});
					});
				},
				error: function() {
					error();
				}
			});
		},

		createVMBox: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		createCallflow: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		createDevice: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'device.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		createSoftPhone: function(data, callback) {
			var self = this,
				formattedDeviceData = {
					device_type: 'softphone',
					owner_id: data.id,
					enabled: true,
					name: data.first_name + ' ' + data.last_name + ' - softphone',
					sip: {
						password: monster.util.randomString(12),
						username: 'user_' + monster.util.randomString(10)
					}
				};

			self.callApi({
				resource: 'device.create',
				data: {
					accountId: self.accountId,
					data: formattedDeviceData
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersUpdateUser: function(user) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: self.accountId,
					userId: user.id,
					data: user
				},
				success: function(data) {
				}
			});
		},

		getUsers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetMainDirectory: function(callback) {
			var self = this;

			self.usersListDirectories(function(listDirectories) {
				var indexMain = -1;

				_.each(listDirectories, function(directory, index) {
					if (directory.name === 'SmartPBX Directory') {
						indexMain = index;

						return false;
					}
				});

				if (indexMain === -1) {
					self.usersCreateMainDirectory(function(data) {
						callback(data);
					});
				} else {
					callback && callback(listDirectories[indexMain]);
				}
			});
		},

		usersListDirectories: function(callback) {
			var self = this;

			self.callApi({
				resource: 'directory.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		usersCreateMainDirectory: function(callback) {
			var self = this,
				dataDirectory = {
					confirm_match: false,
					max_dtmf: 0,
					min_dtmf: 3,
					name: 'SmartPBX Directory',
					sort_by: 'last_name'
				};

			self.callApi({
				resource: 'directory.create',
				data: {
					accountId: self.accountId,
					data: dataDirectory
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
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
						send_email_on_creation: false,
						caller_id: {
							internal: {
								name: callerIdName,
								number: data.extension
							}
						},
						presence_id: data.extension,
						email: data.email
						//directory: data.directories
					}),
					device: $.extend(true, {}, customizations.device, {
						device_type: 'sip_device',
						enabled: true,
						mac_address: data.mac_address.toLowerCase(),
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
						numbers: [data.extension]
					}
				};
			return formattedData;
		}
	};

	return app;
});
