<?php

namespace PccViewer;

/**
*----------------------------------------------------------------------
*<copyright file="Config.php" company="Accusoft Corporation">
*CopyrightÂ© 1996-2014 Accusoft Corporation.  All rights reserved.
*</copyright>
*----------------------------------------------------------------------
*/

/**
 * Class Config
 * @package PccViewer
 * Obtains information from a configuration file (i.e."pcc.config")
 */
class Config {

    public static $pasScheme = "";
    public static $pasHost = "";
    public static $pasPort = "";
    public static $pasUrl = "";
    private static $parent_tag_name;
    private static $child_tag_name;

    /**
     * replace %VARIABLES% with their values
     */
    static function inlineEnvVariables($str) {
        preg_match_all("/\\%([A-Za-z]*)\\%/", $str, $matches, PREG_OFFSET_CAPTURE);

        $ret = $str;
        for ($i = 0, $c = count($matches[0]); $i < $c; $i++) {
            $varname = $matches[1][$i][0];
            $varValue = getenv($varname);
            if ($varValue != null) {
                $ret = substr($ret, 0, $matches[0][$i][1]) .
                        $varValue .
                        substr($ret, $matches[0][$i][1] + strlen($matches[0][$i][0]));
            }
        }

        return $ret;
    }

    /**
     * handles XML element starting
     */
    public static function tagStart($parser, $name, $attrs) {
        if (is_null(self::$parent_tag_name)) {
            self::$parent_tag_name = $name;
        } else {
            if ($name == 'PrizmApplicationServicesScheme' || $name == 'PrizmApplicationServicesHost' || $name == 'PrizmApplicationServicesPort')
                self::$child_tag_name = $name;
        }
    }

    /**
     * handles XML element stop
     */
    public static function tagEnd($parser, $name) {
        if ($name == 'PrizmApplicationServicesScheme' || $name == 'PrizmApplicationServicesHost' || $name == 'PrizmApplicationServicesPort')
            self::$child_tag_name = null;
    }

    /**
     * handles XML data
     */
    public static function tagContent($parser, $data) {
        if (self::$parent_tag_name == 'Config') {
            if (self::$child_tag_name == "PrizmApplicationServicesScheme")
                self::$pasScheme = $data;
            if (self::$child_tag_name == "PrizmApplicationServicesHost")
                self::$pasHost = $data;
            if (self::$child_tag_name == "PrizmApplicationServicesPort")
                self::$pasPort = $data;
        }
    }

    /**
     * improves path appearance
     */
    static function processPath($path, $curPath) {
        $curPath = str_replace("\\", "/", $curPath);
        if (!(strrpos($curPath, "/") === (strlen($curPath) - 1)))
            $curPath = $curPath . "/";
        if ($path == null)
            return null;
        $path = self::inlineEnvVariables($path);
        $path = str_replace("\\", "/", $path);
        if (strpos($path, "./") === 0)
            $path = $curPath . substr($path, 2);
        if (!(strrpos($path, "/") === (strlen($path) - 1)))
            $path = $path . "/";
        return $path;
    }

    /**
     * parses the pcc.config file and stores the contents
     * @param string $config_path path or name of config file
     */
    public static function parse($config_path) {
        $parser = xml_parser_create();

        //xml_set_object($parser, $this);
        xml_set_element_handler($parser, array(self, 'tagStart'), array(self, 'tagEnd'));
        xml_set_character_data_handler($parser, array(self, 'tagContent'));
        xml_parser_set_option($parser, XML_OPTION_CASE_FOLDING, 0);
        $xml = file_get_contents($config_path);

        if (!xml_parse($parser, str_replace(array("\n", "\r", "\t"), '', $xml))) {
            echo xml_error_string(xml_get_error_code($parser));
        }

        self::$pasUrl = self::$pasScheme . '://' . self::$pasHost . ':' . self::$pasPort;
    }

    /**
     * gets the URL for the Prizm Application Services (PAS)
     * @return string
     */
    public static function getPasUrl() {
        return self::$pasUrl;
    }
}
