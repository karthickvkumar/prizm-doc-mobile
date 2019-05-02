<?php

/**
 * ----------------------------------------------------------------------
 * <copyright file="pcc.php" company="Accusoft Corporation">
 * CopyrightÂ© 1996-2014 Accusoft Corporation.  All rights reserved.
 * </copyright>
 * ----------------------------------------------------------------------
 */
error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT);
set_time_limit(600);

use \PccViewer\Request as Request;
use \PccViewer\Config as PccConfig;

PccConfig::parse(dirname(__FILE__) . "/pcc.config");

$urls = array(
    // Resources requested by the HTML5 viewer
    array('regex' => "/^\\/ViewingSession\\/([^\\/]+)\\/SourceFile$/", 'fn' => 'getDocumentAttributes'),
);

$handler = 'proxy';

foreach ($urls as $url) {
    $matches = array();
    if (preg_match($url['regex'], $_SERVER['PATH_INFO'], $matches)) {
        $handler = $url['fn'];
        $handlerParams = $matches;
        break;
    }
}

if (isset($handlerParams)) {
    $handler($handlerParams);
} else {
    $handler();
}

//function proxy($queryParameterWhiteList, $responseHeaderWhiteList) {
function proxy() {

    switch($_SERVER['REQUEST_METHOD']) {

        case 'POST':
            $method = 'post';
            $body = @file_get_contents('php://input');
            break;

        case 'PUT':
            $method = 'put';
            $body = @file_get_contents('php://input');
            break;

        case 'DELETE':
            $method = 'delete';
            $body = @file_get_contents('php://input');
            break;

        case 'GET':
        default:
            $method = 'get';
            break;
    }

    $request = Request::$method(PccConfig::getPasUrl() . $_SERVER['PATH_INFO'])
        ->setQueryParams($_GET);

    // get and forward the request headers
    $headersObj = getallheaders();
    $headersArr = array();
    
    $forwardHeaderFound = false;
    
    foreach($headersObj as $key => $value) {
        
        if (strtolower($key) == "x-forwarded-for") {
            $forwardHeaderFound = true;
        }
        
        array_push($headersArr, "$key: $value");
    }
    
    // add an x-forwarded-for header if one did not exist
    if (!$forwardHeaderFound) {
        $remoteAddr = $_SERVER['REMOTE_ADDR'];
        array_push($headersArr, "X-Forwarded-For: $remoteAddr");
    }
    
    $request->setHeaders($headersArr);
    
    // forward the request body
    if ($body) {
        $request->setBody($body);
    }
    
    $response = $request->send();

    $response->send();
}

// autoloader to handle automatic loading of classes
function __autoload($class_name) {

    $class_name = str_replace('\\', DIRECTORY_SEPARATOR, $class_name);
    require_once("$class_name.php");
}
