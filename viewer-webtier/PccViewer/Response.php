<?php

namespace PccViewer;

class Response {

    public $headers = array();
    public $body;
    public $statusCode;

    public function __construct($status = 200, $curlHeader = null, $body = null, $reasonPhrase = 'unknown') {

        $this->statusCode = $status;
        $this->message = $reasonPhrase;

        if ($curlHeader) {
            $headerParts = explode("\n", $curlHeader);
            foreach ($headerParts as $headerPart) {

                if (strpos($headerPart, ':' ) == false) {
                    continue;
                }

                $headerPieces = explode(':', $headerPart, 2);
                $this->headers[] = array(
                    $headerPieces[0] => trim(str_replace("\r", '', $headerPieces[1]))
                );
            }
        }

        if ($body) {
            $this->body = $body;
        }
    }

    public function send() {

        $code = $this->statusCode;
        $message = $this->message;
        $sapiName = substr(php_sapi_name(),0, 3);

        if ($sapiName != 'cgi' && $sapiName != 'fpm') {
            $protocol = isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.0';
            header($protocol.' '.$code.' '.$message);
        }
        else {
            header('Status: '.$code.' '.$message);
        }

        foreach ($this->headers as $responseHeader) {
            if (current($responseHeader) !== 'chunked') {
                header(key($responseHeader) . ':' . current($responseHeader));
            }
        }

        echo $this->body;
    }
}
