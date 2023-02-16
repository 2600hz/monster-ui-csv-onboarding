define(function(require) {
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
					mandatory: ['first_name', 'last_name', 'password', 'email', 'extension', 'mac_address', 'brand', 'family', 'model', 'device_name'],
					optional: ['notification_email']
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
		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		initApp: function(callback) {
			var self = this;

			// Used to init the auth token and account id of this app
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
								callback: self.renderCsvOnboarding
							}
						]
					}
				]
			});
		},

		renderCsvOnboarding: function(args) {
			var self = this,
				container = args.container,
				initTemplate = function initTemplate() {
					var mainTemplate = $(self.getTemplate({
						name: 'layout',
						data: {
							user: monster.apps.auth.currentUser
						}
					}));

					return mainTemplate;
				},
				afterInsertTemplate = function afterInsertTemplate() {
					self.renderLanding(args);
				};

			monster.ui.insertTemplate(container, function(insertTemplateCallback) {
				insertTemplateCallback(initTemplate(), afterInsertTemplate);
			}, {
				title: self.i18n.active().csvOnboarding.loading.title,
				duration: 1000
			});
		},

		renderLanding: function(args) {
			var self = this,
				container = args.container,
				appendTemplate = function appendTemplate() {
					var template = $(self.getTemplate({
						name: 'landing'
					}));

					container
						.find('.content-wrapper')
							.fadeOut(function() {
								$(this)
									.empty()
									.append(template)
									.fadeIn();
							});

					self.bindLandingEvents(template, args);
				};

			appendTemplate();
		},

		bindLandingEvents: function(template, args) {
			var self = this;

			template
				.find('#users')
					.on('click', function() {
						self.renderAddUsers(_.pick(args, ['container', 'parent']));
					});

			template
				.find('#users_devices')
					.on('click', function() {
						self.renderAddUsersDevices(_.pick(args, ['container', 'parent']));
					});
		},

		renderAddUsers: function(args) {
			var self = this,
				container = args.container,
				appendTemplate = function appendTemplate() {
					var template = $(self.getTemplate({
						name: 'uploadUsers'
					}));

					self.bindAddUsersEvents(template, args);

					container
						.find('.content-wrapper')
							.fadeOut(function() {
								$(this)
									.empty()
									.append(template)
									.fadeIn();
							});
				};

			appendTemplate();
		},

		bindAddUsersEvents: function(template, args, isDevices) {
			var self = this,
				file,
				handleFileSelect = function(evt) {
					file = evt.target.files[0];
					onFileSelected(file);
				},
				onFileSelected = function(file) {
					var isValid = file.name.match('.+(.csv)$');

					if (isValid) {
						addJob();
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

					template
						.find('.start-job-action')
							.attr('disabled', 'disabled');
				},
				addJob = function() {
					var mandatoryColumns = isDevices ? self.appFlags.csvOnboarding.columns.mandatory : self.appFlags.csvOnboarding.columns.userMandatory;

					if (file) {
						Papa.parse(file, {
							header: true,
							skipEmptyLines: true,
							complete: function(results) {
								var fileColumns = _.map(results.meta.fields, _.trim),
									formattedData = {
										fileName: file.name,
										records: _.map(results.data, function(record) {
											return _.mapKeys(record, function(value, key) {
												return _.trim(key);
											});
										}),
										columns: {
											expected: {
												mandatory: mandatoryColumns,
												optional: self.appFlags.csvOnboarding.columns.optional
											},
											actual: fileColumns
										},
										isDevices: isDevices
									};

								self.renderReviewUsers(_.merge({}, args, {
									data: formattedData
								}));
							}
						});
					}
				};

			template
				.find('#back')
					.on('click', function() {
						self.renderLanding(args);
					});

			template
				.find('#upload_csv_file')
					.on('change', function(e) {
						handleFileSelect(e);
					});

			template
				.find('.text-upload')
					.on('click', function() {
						template
							.find('#upload_csv_file')
								.trigger('click');
					});

			var $uploadFrameElement = template.find('.upload-frame').get(0);

			$uploadFrameElement
				.ondragover = function(e) {
					template
						.find('.upload-frame')
							.addClass('hover');

					return false;
				};

			$uploadFrameElement
				.ondragleave = function(e) {
					template
						.find('.upload-frame')
							.removeClass('hover');
					return false;
				};

			$uploadFrameElement
				.ondrop = function(e) {
					template
						.find('.upload-frame')
							.removeClass('hover');

					e.preventDefault();

					file = e.dataTransfer.files[0];
					onFileSelected(file);

					return false;
				};
		},

		renderReviewUsers: function(args) {
			var self = this,
				container = args.container,
				data = args.data,
				appendTemplate = function appendTemplate() {
					var templateData = self.prepareReviewData(data),
						template = $(self.getTemplate({
							name: 'reviewUsers',
							data: templateData
						}));

					self.bindReviewUsers(template, args);

					container
						.find('.content-wrapper')
							.empty()
							.append(template);

					if (templateData.data.totalMandatory === templateData.data.numMatches) {
						template
							.find('.complete')
								.removeClass('hide');

						template
							.find('#proceed')
								.removeClass('disabled');
					} else {
						template
							.find('.incomplete')
								.removeClass('hide');
					}
				};

			appendTemplate(data);
		},

		bindReviewUsers: function(template, args) {
			var self = this,
				container = args.container,
				data = args.data,
				isDevices = data.isDevices,
				expectedColumns = data.columns.expected;

			monster.ui.footable(template.find('.footable'), {
				filtering: {
					enabled: false
				}
			});

			template
				.find('.column-selector')
					.on('click', function(event) {
						event.stopPropagation();

						var $this = $(this),
							$dropdown = $this.parents('.column-data').find('.dropdown-menu-wrapper'),
							$allDropdowns = container.find('#tasks_review_table .dropdown-menu-wrapper'),
							headerHeight = parseFloat(container.find('.footable-header').height()),
							dropdownHeight = parseFloat($dropdown.height()),
							padding = 20,
							minHeight = $dropdown.hasClass('show')
								? ''
								: headerHeight + padding + dropdownHeight;

						if (!$dropdown.hasClass('show')) {
							container
								.find('.dropdown-menu-wrapper')
									.removeClass('show');
						}

						$dropdown
							.toggleClass('show');

						container
							.find('.review-table-wrapper')
								.css('minHeight', minHeight);

						//add checkboxes to selected options
						_.each(container.find('#tasks_review_table .column-selector'), function(element) {
							var $element = $(element),
								value = $element.data('value');

							if (expectedColumns.mandatory.indexOf(value) >= 0) {
								$allDropdowns
									.find('[data-value="' + value + '"]')
										.addClass('selected');
							}
						});
					});

			template
				.on('click', '.dropdown-menu-wrapper a:not(.category)', function() {
					var $this = $(this),
						$dropdown = container.find('#tasks_review_table .dropdown-menu-wrapper'),
						$columnSelected = $this.parents('th').find('.column-selector'),
						selectedArray = [];

					//update the selected value
					$columnSelected
						.find('.column-label')
							.text($this.text());

					$columnSelected
						.data('value', $this.data('value'));

					//close the dropdown
					$dropdown
						.removeClass('show');

					container
						.find('.review-table-wrapper')
							.css('minHeight', '');

					//remove all checkboxes from the menu dropdown
					$dropdown
						.find('a')
							.removeClass('selected');

					_.each(container.find('#tasks_review_table .column-selector'), function(element) {
						var $element = $(element),
							value = $element.data('value');

						if (expectedColumns.mandatory.indexOf(value) >= 0) {
							selectedArray[value] = value;

							$dropdown
								.find('[data-value="' + value + '"]')
									.addClass('selected');
						}
					});

					if (_.keys(selectedArray).length === expectedColumns.mandatory.length) {
						container
							.find('.incomplete')
							.addClass('hide');

						container
							.find('.complete')
							.removeClass('hide');

						container
							.find('#proceed')
							.removeClass('disabled');
					} else {
						container
							.find('.complete')
							.addClass('hide');

						container
							.find('.incomplete')
							.removeClass('hide');

						container
							.find('#proceed')
							.addClass('disabled');
					}

					container
						.find('.numMatches')
						.text(_.keys(selectedArray).length);
				});

			template
				.on('click', '#proceed:not(.disabled)', function() {
					var columnsMatching = self.getColumnsMatching(template),
						formattedData = self.formatTaskData(columnsMatching, data),
						resultCheck = self.checkValidColumns(columnsMatching, expectedColumns, formattedData);

					if (resultCheck.isValid) {
						var hasCustomizations = template.find('.has-customizations').prop('checked');
						var addToMainDirectory = template.find('.add-to-main-directory').prop('checked');

						if (hasCustomizations) {
							self.renderCustomizations(args, formattedData.data, function(customizations) {
								self.startProcess(_.merge({}, _.pick(args, ['container', 'parent']), {
									data: {
										reviewData: formattedData.data,
										customizations: customizations,
										isDevices: isDevices,
										addToMainDirectory: addToMainDirectory
									}
								}));
							});
						} else {
							self.startProcess(_.merge({}, _.pick(args, ['container', 'parent']), {
								data: {
									reviewData: formattedData.data,
									isDevices: isDevices,
									addToMainDirectory: addToMainDirectory
								}
							}));
						}
					} else {
						var msg = self.i18n.active().csvOnboarding.review.errors.title + '<br/><br/>';

						_.each(resultCheck.errors, function(v, category) {
							_.each(v, function(column) {
								msg += '<strong>' + column + '</strong> : ' + self.i18n.active().csvOnboarding.review.errors[category] + '<br/>';
							});
						});

						monster.ui.alert('error', msg);
					}
				});

			template
				.find('#cancel')
					.on('click', function() {
						self.renderCsvOnboarding(args);
					});

			template
				.on('click', function(event) {
					var dropdown = template.find('.dropdown-menu-wrapper'),
						divElement = template.find('.colum-selector');

					if (!(dropdown.is(event.target) || divElement.is(event.target)) && (divElement.has(event.target).length || dropdown.has(event.target).length) === 0) {
						dropdown.removeClass('show');

						container
							.find('.review-table-wrapper')
								.css('minHeight', '');
					}
				});
		},

		renderAddUsersDevices: function(args) {
			var self = this,
				container = args.container,
				appendTemplate = function appendTemplate() {
					var template = $(self.getTemplate({
						name: 'uploadUsersDevices'
					}));

					self.bindAddUsersEvents(template, args, true);

					container
						.find('.content-wrapper')
							.fadeOut(function() {
								$(this)
									.empty()
									.append(template)
									.fadeIn();
							});
				};

			appendTemplate();
		},

		startProcess: function(args) {
			var self = this,
				container = args.container,
				data = args.data,
				reviewData = data.reviewData,
				isDevices = data.isDevices,
				addToMainDirectory = data.addToMainDirectory,
				template = $(self.getTemplate({
					name: 'progress',
					data: {
						totalRequests: reviewData.length
					}
				})), successRequests = 0,
				listUserCreate = [];

			container
				.find('.content-wrapper')
					.empty()
					.append(template);

			_.each(reviewData, function(userData) {
				var formatOptions = {
					customizations: data.customizations ? data.customizations : {},
					addToMainDirectory: addToMainDirectory
				};

				var newData = self.formatUserData(userData, formatOptions);

				if (isDevices) { // users and devices
					listUserCreate.push(function(callback) {
						self.createUserDevices(newData,
							function(sdata) { // on success
								if (sdata.user) {
									successRequests = successRequests + 1;
								}
								var percentFilled = Math.ceil((successRequests / data.length) * 100);
								template.find('.count-requests-done').html(successRequests);
								template.find('.count-requests-total').html(data.length);
								template.find('.inner-progress-bar').attr('style', 'width: ' + percentFilled + '%');
								callback(null, sdata);
							},
							function(parsedError) { // on error
								callback(null, parsedError);
							});
					});
				} else { //users only
					listUserCreate.push(function(callback) {
						self.createUserCallflow(newData,
							function(sdata) {
								if (sdata.user) {
									successRequests = successRequests + 1;
								}
								var percentFilled = Math.ceil((successRequests / data.length) * 100);
								template.find('.count-requests-done').html(successRequests);
								template.find('.count-requests-total').html(data.length);
								template.find('.inner-progress-bar').attr('style', 'width: ' + percentFilled + '%');
								callback(null, sdata);
							},
							function(parsedError) {
								callback(null, parsedError);
							}
						);
					});
				}
			});

			monster.parallel(listUserCreate, function(err, results) {
				var tmpData = {
					count: _
						.chain(results)
						.filter(function(result) {
							return _.has(result, 'user');
						})
						.size()
						.value(),
					deviceCount: isDevices
						? _
							.chain(results)
							.filter(function(result) {
								return _.has(result, 'device');
							})
							.size()
							.value()
						: 0,
					account: monster.apps.auth.currentAccount.name,
					isDevices: isDevices,
					errors: {
						name: [],
						extension: [],
						mac: []
					},
					boxText: 'Success!',
					boxType: 'success',
					errorCount: 0
				};

				if (tmpData.count === 0) {
					tmpData.boxText = 'Error!';
					tmpData.boxType = 'warning';
				}

				// show error dialog for errors
				var tmpErrs = [];

				if (isDevices) {
					_.each(results, function(object) {
						if (object.err && object.err.status === 'error') {
							tmpErrs.push(object.err);
						}
					});
				} else {
					tmpErrs = _.filter(results, { status: 'error' });
				}

				if (tmpErrs && tmpErrs.length > 0) {
					_.each(tmpErrs, function(item) {
						if (item && item.error === '400') {
							tmpData.errorCount++;

							if (item.data.username && item.data.username.unique) {
								tmpData.errors.name.push(item.data.username.unique.cause);
							}

							if (item.data.mailbox && item.data.mailbox.unique) {
								tmpData.errors.name.push(item.data.mailbox.unique.cause);
							}

							if (item.data.mac_address && item.data.mac_address.unique) {
								tmpData.errors.name.push(item.data.mac_adress.unique.cause);
							}
						}
					});
				}

				self.renderResults(_.merge({}, _.pick(args, ['container', 'parent']), {
					data: tmpData
				}));
			});
		},

		renderResults: function(args) {
			var self = this,
				container = args.container,
				data = args.data,
				appendTemplate = function appendTemplate(data) {
					var template = $(self.getTemplate({
						name: 'results',
						data: data
					}));

					self.bindRenderResults(template, args);

					container
						.find('.content-wrapper')
							.empty()
							.append(template);
				};

			appendTemplate(data);
		},

		bindRenderResults: function(template, args) {
			var self = this;

			template
				.find('#back')
					.on('click', function() {
						self.renderLanding(args);
					});
		},

		renderCustomizations: function(args, data, onContinue) {
			var self = this,
				appendTemplate = function appendTemplate() {
					var template = $(self.getTemplate({
						name: 'customizations'
					}));

					self.bindRenderCustomizations(template, args, onContinue);
				};

			appendTemplate();
		},

		bindRenderCustomizations: function(template, args, onContinue) {
			var self = this,
				container = args.container,
				getJson = function(str) {
					try {
						return JSON.parse(str);
					} catch (e) {
						return {};
					}
				};

			template
				.find('textarea')
					.on('keyup', function() {
						var $this = $(this),
							val = $this.val(),
							jsonValue = getJson(val);

						if (!_.isEmpty(jsonValue)) {
							$this.siblings('.json-result').empty();
							monster.ui.renderJSON(jsonValue, $this.siblings('.json-result'));
						}
					});

			template
				.find('.continue')
					.on('click', function() {
						var customizations = {
							user: getJson(template.find('textarea[data-type="user"]').val()),
							device: getJson(template.find('textarea[data-type="device"]').val()),
							vmbox: getJson(template.find('textarea[data-type="vmbox"]').val())
						};

						onContinue && onContinue(customizations);
					});

			container
				.find('.content-wrapper')
					.empty()
					.append(template);
		},

		// utility fn
		createUserDevices: function(data, callback, callbackErr) {
			var self = this,
				resultData = {};

			monster.waterfall([
				function(waterfallCallback) {
					self.createUser(data.user,
						function(udata) { // on success
							var userId = udata.data.id;
							data.user.id = userId;
							data.vmbox.owner_id = userId;
							data.device.owner_id = userId;
							resultData.user = udata.data;
							waterfallCallback(null, udata);
						},
						function(parsedError) { // on error
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
						}
					);
				},
				function(_data, waterfallCallback) {
					self.createVMBox(data.vmbox,
						function(vmdata) { // on success
							resultData.vmbox = vmdata;
							data.callflow.flow.children._.data.id = vmdata.id;
							waterfallCallback(null, vmdata);
						},
						function(parsedError) { // on error
							parsedError.data.mailbox.unique.cause = data.vmbox.mailbox;
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
						}
					);
				},
				function(_data, waterfallCallback) {
					self.createDevice(data.device,
						function(devicedata) { // on success
							resultData.device = devicedata;
							waterfallCallback(null, devicedata);
						},
						function(parsedError) { // on error
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
						}
					);
				},
				function(_data, waterfallCallback) {
					data.callflow.owner_id = data.user.id;
					data.callflow.type = 'mainUserCallflow';
					data.callflow.flow.data.id = data.user.id;

					self.createCallflow(data.callflow,
						function(cfdata) {
							resultData.callflow = cfdata;
							waterfallCallback(null, cfdata);
						},
						function(parsedError) {
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
						}
					);
				},
				function(_data, waterfallCallback) {
					if (!data.addToMainDirectory) {
						waterfallCallback(null, _data);
					} else {
						self.addUserToMainDirectory(
							resultData.user,
							resultData.callflow.id,
							function() {
								waterfallCallback(null, _data);
							},
							function(parsedError) {
								resultData.err = parsedError;
								waterfallCallback(true, parsedError);
							}
						);
					}
				}
			], function(err, result) {
				if (err) {
					callbackErr && callbackErr(resultData);
				} else {
					callback && callback(resultData);
				}
			});
		},

		createUserCallflow: function(data, callback, callbackError) {
			var self = this,
				resultData = {};

			monster.waterfall([
				function(waterfallCallback) {
					self.createUser(data.user,
						function(userData) {
							data.user.id = _.get(userData, 'data.id', '');
							resultData.user = userData.data;
							waterfallCallback(null, userData);
						},
						function(parsedError) {
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
						}
					);
				},
				function(_data, waterfallCallback) {
					data.vmbox.owner_id = data.user.id;

					self.createVMBox(data.vmbox,
						function(vmdata) {
							resultData.vmbox = vmdata;
							data.callflow.flow.children._.data.id = vmdata.id;
							waterfallCallback(null, vmdata);
						},
						function(parsedError) {
							parsedError.data.mailbox.unique.cause = data.vmbox.mailbox;
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
						}
					);
				},
				function(_data, waterfallCallback) {
					data.callflow.owner_id = data.user.id;
					data.callflow.type = 'mainUserCallflow';
					data.callflow.flow.data.id = data.user.id;
					data.callflow.numbers = [data.user.presence_id];

					self.createCallflow(data.callflow,
						function(cfdata) {
							resultData.callflow = cfdata;
							waterfallCallback(null, cfdata);
						},
						function(parsedError) {
							resultData.err = parsedError;
							waterfallCallback(true, parsedError);
						}
					);
				},
				function(_data, waterfallCallback) {
					if (!data.addToMainDirectory) {
						waterfallCallback(null, _data);
					} else {
						self.addUserToMainDirectory(
							resultData.user,
							resultData.callflow.id,
							function() {
								waterfallCallback(null, _data);
							},
							function(parsedError) {
								resultData.err = parsedError;
								waterfallCallback(true, parsedError);
							}
						);
					}
				}
			], function(err, result) {
				if (err) {
					callbackError && callbackError(resultData);
				} else {
					callback && callback(resultData);
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
				mappings[$this.data('column')] = $this.find('.column-selector').data('value');
			});

			return mappings;
		},

		checkValidColumns: function(columns, requiredColumns, data) {
			var self = this,
				records = data.data,
				mapColumns = {
					mandatory: {},
					optional: {}
				},
				isValid = true,
				errors = {
					missing: [],
					tooMany: [],
					duplicateEmail: [],
					duplicateExtension: [],
					duplicateMac: []
				},
				getDuplicatesBy = function getDuplicates(prop) {
					return _
						.chain(records)
						.groupBy(prop)
						.pickBy(function(record) {
							return record.length > 1;
						})
						.keys()
						.value();
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

				if (column === 'email') {
					if (_.uniqBy(records, 'email').length !== records.length) {
						errors.duplicateEmail = getDuplicatesBy('email');
						isValid = false;
					}
				}

				if (column === 'extension') {
					if (_.uniqBy(records, 'extension').length !== records.length) {
						errors.duplicateExtension = getDuplicatesBy('extension');
						isValid = false;
					}
				}
				if (column === 'mac_address') {
					if (_.uniqBy(records, 'mac_address').length !== records.length) {
						errors.duplicateMac = getDuplicatesBy('mac_address');
						isValid = false;
					}
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
			var self = this,
				expected = _.get(data, 'columns.expected', []),
				modifiersPerProp = {
					brand: _.toLower,
					family: _.toLower,
					model: _.toLower
				},
				formattedData = {
					data: {
						fileName: data.fileName,
						totalRecords: data.records.length,
						columns: {
							actual: data.columns.actual,
							expected: expected,
							others: []
						},
						recordsToReview: data.isDevices ? _.map(data.records, function(record) {
							return _.chain({})
								.merge(record, _.reduce(record, function(acc, value, prop) {
									var modifier = _.get(modifiersPerProp, prop, _.identity);
									return _.set(acc, prop, modifier(value));
								}, {}))
								.omit(['__parsed_extra'])
								.value();
						}) : data.records,
						numMatches: 0,
						totalMandatory: data.columns.expected.mandatory.length,
						numString: ''
					}
				};

			var occurences;

			// for each column in the csv, we check if it's one of the column mandatory or optional in that job.
			// If not, then we add it to the list of 'others' columns to choose from
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

				if (expected.mandatory.indexOf(actualColumnName) >= 0) {
					formattedData.data.numMatches++;
				}
			});

			formattedData.data.numString = self.convertNumberToText(formattedData.data.numMatches);

			return formattedData;
		},

		formatUserData: function(data, options) {
			var self = this,
				customizations = options.customizations,
				fullName = data.first_name + ' ' + data.last_name,
				callerIdName = fullName.substring(0, 15),
				formattedData = {
					rawData: data,
					addToMainDirectory: options.addToMainDirectory,
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
						email: data.notification_email ? data.notification_email : data.email
					}),
					device: $.extend(true, {}, customizations.device, {
						device_type: 'sip_device',
						enabled: true,
						mac_address: data.mac_address,
						name: data.device_name,
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
		},

		convertNumberToText: function(num) {
			var self = this,
				a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '],
				b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

			//add check for zero
			if (num === 0) {
				return self.i18n.active().csvOnboarding.review.misc.zero;
			}

			if ((num = num.toString()).length > 9) return 'overflow';
			var n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);

			if (!n) return; var str = '';
			str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
			str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
			str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
			str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
			str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'only ' : '';

			return str.replace('only', '').trim();
		},

		//API endpoints
		/**************************************************
		 *            Requests declaration                 *
		 **************************************************/
		createUser: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'user.create',
				data: {
					accountId: self.accountId,
					acceptCharges: true,
					data: data,
					generateError: false
				},
				success: function(data, status) {
					callback && callback(data);
				},
				error: function(parsedError) {
					err && err(parsedError);
				}
			});
		},

		createVMBox: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				data: {
					accountId: self.accountId,
					acceptCharges: true,
					data: data,
					generateError: false
				},
				success: function(data) {
					callback(data.data);
				},
				error: function(parsedError) {
					err && err(parsedError);
				}
			});
		},

		createCallflow: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: self.accountId,
					acceptCharges: true,
					data: data,
					generateError: false
				},
				success: function(data) {
					callback(data.data);
				},
				error: function(parsedError) {
					err && err(parsedError);
				}
			});
		},

		createDevice: function(data, callback, err) {
			var self = this;

			self.callApi({
				resource: 'device.create',
				data: {
					accountId: self.accountId,
					acceptCharges: true,
					data: data,
					generateError: false
				},
				success: function(data) {
					callback(data.data);
				},
				error: function(parsedError) {
					err && err(parsedError);
				}
			});
		},

		updateUser: function(userData, callback) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: self.accountId,
					userId: userData.id,
					data: userData
				},
				success: function(userData) {
					callback && callback(userData);
				}
			});
		},

		listAccountDirectories: function(callback) {
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

		getMainDirectory: function(callback) {
			var self = this;

			self.listAccountDirectories(function(listDirectories) {
				var mainDirectory = _.find(listDirectories, { name: 'SmartPBX Directory' });

				if (mainDirectory) {
					callback(mainDirectory);
				} else {
					self.usersCreateMainDirectory(function(data) {
						callback(data);
					});
				}
			});
		},

		addUserToMainDirectory: function(user, callflowId, callback, callbackErr) {
			var self = this;

			self.getMainDirectory(function(directory) {
				user.directories = user.directories || {};
				user.directories[directory.id] = callflowId;

				self.updateUser(user, function(data) {
					callback && callback(data);
				}, function(error) {
					callbackErr && callbackErr(error);
				});
			});
		}
	};

	return app;
});
