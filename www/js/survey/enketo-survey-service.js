angular.module("emission.enketo-survey.service", [
    "ionic",
    "emission.services",
    "emission.plugin.logger",
    "emission.tripconfirm.service",
]).factory("EnketoSurvey", function(
    $window, $http, UnifiedDataLoader,
    ConfirmHelper
) {
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

        return $http.get(__form_location
        ).then(function(form_json) {
            __loaded_form = form_json.data.form;
            __loaded_model = form_json.data.model;
        });
    }

    function _loadForm(opts = {}) {
        var formSelector = "form.or:eq(0)";
        var data = {
            // required string of the default instance defined in the XForm
            modelStr: __loaded_model,
            // optional string of an existing instance to be edited
            instanceStr: opts.instanceStr || null,
            submitted: opts.submitted || false,
            external: opts.external || [],
            session: opts.session || {},
        };
        __form = new $window.FormModule( formSelector, data, {});
        var loadErrors = __form.init();
        return loadErrors;
    }

    function _restoreAnswer(answers) {
        const answer = ConfirmHelper.getUserInputForTrip(__session.trip_properties, answers);
        return (!answer) ? null : answer.data.survey_result;
    }

    function _parseAnswerByTagName(answerXml, tagName) {
        const vals = answerXml.getElementsByTagName(tagName);
        const val = vals.length ? vals[0].innerHTML : null;
        if (!val) return "<null>";
        return val.replace(/_/g, " ");
    }

    function getAllSurveyAnswers(key = "manual/confirm_survey", opts = {}) {
        const _opts_populateLabels = opts.populateLabels || false;

        const tq = $window.cordova.plugins.BEMUserCache.getAllTimeQuery();
        return UnifiedDataLoader.getUnifiedMessagesForInterval(key, tq
        ).then(function(answers){
            if (!_opts_populateLabels) return answers;

            const xmlParser = new $window.DOMParser();
            if (key === "manual/confirm_survey") {
                return answers.map(function(answer){
                    const xmlStr = answer.data.survey_result;
                    const xml = xmlParser.parseFromString(xmlStr, "text/xml");
                    // Data injection
                    answer.travel_mode_main = _parseAnswerByTagName(xml, "travel_mode_main");
                    answer.o_purpose_main = _parseAnswerByTagName(xml, "o_purpose_main");
                    answer.d_purpose_main = _parseAnswerByTagName(xml, "d_purpose_main");
                    return answer;
                });
            }

            return answers;
        });
    }

    function displayForm() {
        let data_key = (__session && __session.data_key) ?
            __session.data_key :
            "manual/confirm_survey";
        return getAllSurveyAnswers(data_key
        ).then(_restoreAnswer
        ).then(function(answerData) {
            return _loadForm({ instanceStr: answerData });
        });
    }

    function _saveData() {
        const data = {
            survey_result: __form.getDataStr(),
            start_ts: __session.trip_properties.start_ts,
            end_ts: __session.trip_properties.end_ts,
        };
        return $window.cordova.plugins.BEMUserCache.putMessage(__session.data_key, data);
    }
  
    function validateForm() {
        return __form.validate(
        ).then(function (valid){
            if (valid) return _saveData().then(function(){return valid;});
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
