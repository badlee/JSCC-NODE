# JS/CC-NODE

This project is a port of [JS/CC](http://jscc.jmksf.com) to nodejs,

## INTRODUCTION

JS/CC is the first available parser development system for [JavaScript and ECMAScript-derivates](http://en.wikipedia.org/wiki/ECMAScript). It has been developed, both, with the intention of building a productive compiler development system and with the intention of creating an easy-to-use academic environment for people interested in how parse table generation is done general in bottom-up parsing.

The platform-independent software unions both: A regular expression-based [lexical analyzer](http://en.wikipedia.org/wiki/Lexer) generator matching individual tokens from the input character stream and a [LALR(1)](http://en.wikipedia.org/wiki/LALR_parser) parser generator, computing the parse tables for a given context-free grammar specification and building a stand-alone, working parser. The [context-free grammar](http://en.wikipedia.org/wiki/Context-free_grammar) fed to JS/CC is defined in a [Backus-Naur-Form-based](http://en.wikipedia.org/wiki/Backus_Naur_Form) meta language, and allows the insertion of individual semantic code to be evaluated on a rule's reduction.

JS/CC itself has been entirely written in ECMAScript so it can be executed in many different ways: as platform-independent, browser-based JavaScript embedded on a Website, as a Windows Script Host Application, as a compiled JScript.NET executable, as a Mozilla/Rhino or Mozilla/Spidermonkey interpreted application, or a V8 shell script on Windows, *nix, Linux and Mac OSX. However, for productive execution, it is recommended to use the command-line versions. These versions are capable of assembling a complete compiler from a JS/CC parser specification, which is then stored to a .js JavaScript source file.

To use JS/CC and for understanding its internals and behavior, some knowledge of context-free grammars, bottom-up parsing techniques and compiler construction theory, in general, is assumed.

## DOCUMENTATION

For all documentation read doc file in doc/

## HOW TO USE
	
node jscc.js [options] filename

## OPTIONS

	-h   --help               Print this usage help
	-i   --version            Print version and copyright
	-o   --output <file>      Save output source to <file>
	-p   --prefix <prefix>    Use <prefix> as sequence pre-fixing methods and variables
	-t   --template <file>    Use template file <file> as parser template by defalut driver_node.js_
	-v   --verbose            Run in verbose mode
	-w   --warnings           Print warnings
	-c   --compress           Compress output source using PACKER BASE62
	-s   --shrink             Shrink variables of output source using PACKER
	-cs   --compress-shrink   Shrink variables of output source and Compress output source using PACKER BASE62
	-m   --minimize           Minimize output source using PACKER

## Examples

For sample grammar see par/ folder.
You will found:
- **dragon.par** : Port of my own language to javascript (port is partial)
- **php.par**    : Grammar from phype project (port of php is partial)
- **ruby.par**   : Grammar from phype project (port of ruby is partial)
- **calc.par**   : Calculator grammar from JS/CC sample
- **xpl.par**	 : gramar for eXample Programming Language from JS/CC
