"use strict;"
var prizmDoc = angular.module('PrizmDoc', []);

prizmDoc.controller('EditorController', function($scope, $q, $filter, $http) {
    $scope.serverURL = 'https://nsnonprodwebapi.azurewebsites.net/api'
    $scope.isLoading = true;
    var fetchHeaders = {
      'user-agent': 'Mozilla/4.0 MDN Example',
      'content-type': 'application/json',
      'pragma' : 'no-cache',
      'cache-control' : 'no-cache'
    }

    var options = {
        imageHandlerUrl: "viewer-webtier/pas.php",
        resourcePath: "viewer-assets/img"
    }

    function postMethod(url, param){
        var promise = fetch(url, {
          body: JSON.stringify(param),
          credentials: 'include',
          headers: fetchHeaders,
          method: 'POST',
        })
        .then(function (response) {
            return response.json()
        }).then(function (json) {  
            return json;
        }).catch(function (error) {
            console.error(error);
        })
        return promise;
    };

    function getMethod(url){
        var promise = fetch(url, {
          credentials: 'include',
          headers: fetchHeaders,
          method: 'GET',
        })
        .then(function (response) {
            return response.json()
        }).then(function (json) {  
            return json;
        }).catch(function (error) {
            console.error(error);
        })
        return promise;
    };

    function getResource(url, dataType) {
        return $.ajax({
            url: url,
            dataType: dataType
        })
            .then(function (response) {
                return response;
            });
    }

    function getJson(fileName) {
        return getResource(fileName)
            .then(function (response) {
                if (typeof response === 'string') {
                    return JSON.parse(response);
                }
                return response;
            });
    }


    function buildViewerOptions(){
        var args = [].slice.call(arguments);
        var optionsOverride = args.pop();
        var options = {
            annotationsMode: "LayeredAnnotations",
            documentID: encodeURIComponent(args[1]),
            icons: args[4],
            language: args[3],
            template: args[2],
            predefinedSearch: args[3],
            signatureCategories: 'Signature,Initials,Title',
            immediateActionMenuMode: 'hover',
            documentDisplayName: args[0],
            uiElements: {
                download: true,
                fullScreenOnInit: true,
                advancedSearch: true
            },
            discardOutOfViewText: true
        };

        var combinedOptions = _.extend(optionsOverride, options);
        $('#prizm-doc-viewer').pccViewer(combinedOptions).viewerControl;
    }

    $scope.loginCredential = function(){
        var url = '/authentication/login';
        var credential = {
            "userName":"karthickkv.dev@auxolabs.in",
            "password":"Test@123"
        };
        postMethod($scope.serverURL + url, credential).then(function(response) {
            var url = '/viewer/sessions?queueId=5c76a6f45b53411a149de3d1&documentId=5cb42e53f81a4347c0d631f9&version=0&isRefresh=false';
            $scope.userCredential = response;
            $scope.isLoading = false;
            postMethod($scope.serverURL + url, null).then(function(response) {
                PCCViewer.Ajax.headers = {
                    'Accusoft-Affinity-Token': response.affinityToken,
                    'Authorization': $scope.userCredential.token
                };

                $.when(
                    '5cb42e53f81a4347c0d631f9',
                    response.viewingSessionId,
                    templateContent,
                    getJson('viewer-assets/languages/en-US.json'),
                    getResource('viewer-assets/icons/svg-icons.svg', 'text'),
                    options || {}
                ).done(buildViewerOptions);
            });
        });
    };

    $scope.loginCredential();
});

