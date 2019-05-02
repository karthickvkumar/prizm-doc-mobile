<?php

namespace PccViewer;

class Request {

    private $_url,
            $_method,
            $_body,
            $_headers,
            $_queryParams,
            $_queryParameterWhiteList;

    const GET = 'GET';
    const POST = 'POST';
    const PUT = 'PUT';
    const DELETE = 'DELETE';

    const HTTP_OK = 200;
    const HTTP_CREATED = 201;
    const HTTP_ACCEPTED = 202;

    // Make constructor private to enforce instantiation only from the static functions within this class.
    private function __construct() {
    }

    public static function init($url) {
        $request = new Request();
        return $request
            ->setUrl($url);
    }

    public static function get($url) {
        return self::init($url)->setMethod(self::GET);
    }

    public static function post($url) {
        return self::init($url)->setMethod(self::POST);
    }

    public static function put($url) {
        return self::init($url)->setMethod(self::PUT);
    }

    public static function delete($url) {
        return self::init($url)->setMethod(self::DELETE);
    }

    public function setUrl($url) {
        $this->_url = $url;
        return $this;
    }

    public function getUrl() {
        return $this->_url;
    }

    public function getQueryUrl() {

        $url = $this->_url;
        $paramString = '';

        if ($this->_queryParams) {
            $paramString = http_build_query($this->_queryParams);
        }

        if ($paramString) {
            $url .= '?' . $paramString;
        }

        return $url;
    }

    public function setQueryParameterWhiteList($queryParameterWhiteList) {
        $this->_queryParameterWhiteList = $queryParameterWhiteList;
        return $this;
    }

    public function getQueryParameterWhiteList() {
        return $this->_queryParameterWhiteList;
    }

    public function setQueryParams($params) {
        $this->_queryParams = $params;
        return $this;
    }

    public function getQueryParams() {
        return $this->_queryParams;
    }

    public function setHeaders($headers) {
        $this->_headers = $headers;
        return $this;
    }

    public function getHeaders() {
        return $this->_headers;
    }

    public function setMethod($method) {
        $this->_method = $method;
        return $this;
    }

    public function getMethod() {
        return $this->_method;
    }

    public function setBody($data) {
        $this->_body = $data;
        return $this;
    }

    public function getBody() {
        return $this->_body;
    }

    public function send() {
        $ch = curl_init();

        $curlOptions = array(
            CURLOPT_HEADER => 1,
            CURLOPT_URL => $this->getQueryUrl(),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $this->_method
        );

        if (count($this->_headers)) {
            $curlOptions[CURLOPT_HTTPHEADER] = $this->_headers;
        }

        if ($this->_body) {
            $curlOptions[CURLOPT_POSTFIELDS] = $this->_body;
        }

        curl_setopt_array($ch, $curlOptions);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        $reasonPhrase = 'unknown';
        if (preg_match('#^HTTP/1.(?:0|1) [\d]{3} (.*)$#m', $response, $match)) {
            $reasonPhrase = $match[1];
        }

        $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

        if ($response == false) {
            $response = new Response(502);
        } else {
            $response = new Response($status, substr($response, 0, $header_size), substr($response, $header_size), $reasonPhrase);
        }

        curl_close($ch);

        return $response;
    }

}
