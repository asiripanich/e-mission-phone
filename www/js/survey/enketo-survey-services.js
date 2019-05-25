angular.module('emission.enketo-survey.services', [
  'ionic',
  'emission.services',
  'emission.plugin.logger'
])
.factory('EnketoSurvey', function($window, $http, UnifiedDataLoader, Logger) {
  var __form = null;
  var __session = {};
  var __form_location = null;
  var __loaded_form = null;
  var __loaded_model = null;

  function init(formLocParam, optsParam) {
    __form = null;
    __session = {};
    __form_location = formLocParam;
    __loaded_form = null;
    __loaded_model = null;

    const opts = JSON.parse(optsParam);
    if (opts && opts.session) {
      __session = opts.session;
    }

    return $http.get(__form_location)
    .then(function(form_json) {
      __loaded_form = form_json.data.form;
      __loaded_model = form_json.data.model;
    });
  }

  function _loadForm(opts = {}) {
    var formSelector = 'form.or:eq(0)';
    var data = {
      // required string of the default instance defined in the XForm
      modelStr: __loaded_model,
      // optional string of an existing instance to be edited
      instanceStr: opts.instanceStr || null,
      submitted: opts.submitted || false,
      external: opts.external || [],
      session: opts.session || {}
    };
    __form = new $window.FormModule( formSelector, data, {});
    var loadErrors = __form.init();
    return loadErrors;
  }

  /**
   * _printUserInput
   * Borrowed from `DiaryHelper.printUserInput` in file `www/js/diary/services.js`
   * to avoid circular dependency
   */
  function _printUserInput(ui) {
    // Type: Survey Answer
    if (angular.isDefined(ui.data.trip_properties)) {
      return ui.data.trip_properties.start_ts + " -> "+ ui.data.trip_properties.end_ts +
        " logged at "+ ui.metadata.write_ts;
    }

    // Default: Mode / Purpose
    return ui.data.start_ts + " -> "+ ui.data.end_ts + 
        " " + ui.data.label + " logged at "+ ui.metadata.write_ts;
  }

  /**
   * _getUserInputForTrip
   * Borrowed from `DiaryHelper.getUserInputForTrip` in file `www/js/diary/services.js`
   * to avoid circular dependency
   */
  function _getUserInputForTrip(tripProp, userInputList) {
    var potentialCandidates = userInputList.filter(function(userInput) {
        // Type: Survey Answer
        if (angular.isDefined(userInput.data.trip_properties)) {
          return userInput.data.trip_properties.start_ts >= tripProp.start_ts &&
            userInput.data.trip_properties.end_ts <= tripProp.end_ts;
        }

        // Default: Mode / Purpose
        return userInput.data.start_ts >= tripProp.start_ts &&
          userInput.data.end_ts <= tripProp.end_ts;
    });
    if (potentialCandidates.length === 0)  {
        Logger.log("In getUserInputForTripStartEnd, no potential candidates, returning []");
        return undefined;
    }

    if (potentialCandidates.length === 1)  {
        Logger.log("In getUserInputForTripStartEnd, one potential candidate, returning  "+ _printUserInput(potentialCandidates[0]));
        return potentialCandidates[0];
    }

    Logger.log("potentialCandidates are "+potentialCandidates.map(_printUserInput));
    var sortedPC = potentialCandidates.sort(function(pc1, pc2) {
        return pc2.metadata.write_ts - pc1.metadata.write_ts;
    });
    var mostRecentEntry = sortedPC[0];
    Logger.log("Returning mostRecentEntry "+_printUserInput(mostRecentEntry));
    return mostRecentEntry;
  }

  function _restoreAnswer(answers) {
    const answer = _getUserInputForTrip(__session.trip_properties, answers);
    return (!answer) ? null : answer.data.dataStr;
  }

  function getAllSurveyAnswers(key = 'manual/confirm_survey', opts = {}) {
    const _opts_populateLabels = opts.populateLabels || false;

    const tq = $window.cordova.plugins.BEMUserCache.getAllTimeQuery();
    return UnifiedDataLoader.getUnifiedMessagesForInterval(key, tq)
    .then(function(answers){
      if (!_opts_populateLabels) return answers;

      const xmlParser = new $window.DOMParser();
      if (key === 'manual/confirm_survey') {
        return answers.map(function(answer){
          const xmlStr = answer.data.dataStr;
          const xml = xmlParser.parseFromString(xmlStr, 'text/xml');

          // Travel Mode
          const travelModes = xml.getElementsByTagName('travel_mode_main');
          const travelMode = travelModes.length ? travelModes[0].innerHTML : null;
          const travelModeLabel = travelMode ? travelMode.charAt(0).toUpperCase() + travelMode.slice(1) : '';

          // Travel Purpose
          const travelPurposes = xml.getElementsByTagName('travel_purpose_main');
          const travelPurpose = travelPurposes.length ? travelPurposes[0].innerHTML : null;
          const travelPurposeLabel = travelPurpose ? travelPurpose.charAt(0).toUpperCase() + travelPurpose.slice(1) : '';

          // Result Population
          answer.mode_label = travelModeLabel;
          answer.purpose_label = travelPurposeLabel;
          return answer;
        });
      }

      return answers;
    });
  }

  function displayForm() {
    // Load survey with previous answer
    if (__session &&
        __session.data_key &&
        __session.data_key === 'manual/confirm_survey'
    ) {
      return getAllSurveyAnswers(__session.data_key)
      .then(_restoreAnswer)
      .then(function(answerData) {
        return _loadForm({ instanceStr: answerData });
      });
    }
    return _loadForm();
  }

  function _saveData() {
    const value = {
      dataStr: __form.getDataStr(),
      trip_properties: __session.trip_properties,
    };
    return $window.cordova.plugins.BEMUserCache.putMessage(__session.data_key, value);
  }
  
  function validateForm() {
    return __form.validate()
    .then(function (valid){
      if (valid) return _saveData().then(function(){return valid});
      return valid;
    });
  }

  function getState() {
    return {
      form: __form,
      session: __session,
      loaded_form: __loaded_form,
      loaded_model: __loaded_model,
    };
  }

  return {
    init: init,
    displayForm: displayForm,
    validateForm: validateForm,
    getAllSurveyAnswers: getAllSurveyAnswers,
    getState: getState,
  };
});