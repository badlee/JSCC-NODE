# JS/CC-NODE

This project is a implementation of [JS/CC](http://jscc.jmksf.com) to nodejs (version >= 0.4.7).

## INTRODUCTION

JS/CC is the first available parser development system for [JavaScript and ECMAScript-derivates](http://en.wikipedia.org/wiki/ECMAScript). It has been developed, both, with the intention of building a productive compiler development system and  creating an easy-to-use academic environment for people interested in how parse table generation is done generally in bottom-up parsing.

The platform-independent software unions both: A regular expression-based [lexical analyzer](http://en.wikipedia.org/wiki/Lexer) generator matching individual tokens from the input character stream and a [LALR(1)](http://en.wikipedia.org/wiki/LALR_parser) parser generator, computing the parse tables for a given context-free grammar specification and building a stand-alone, working parser. The [context-free grammar](http://en.wikipedia.org/wiki/Context-free_grammar) feeds to JS/CC is defined in a [Backus-Naur-Form-based](http://en.wikipedia.org/wiki/Backus_Naur_Form) meta language, and allows the insertion of individual semantic code to be evaluated on a rule's reduction.

JS/CC itself has been entirely written in JavaScript. These versions are capable of assembling a complete compiler from a JS/CC parser specification, which is then stored to a .js JavaScript source file.

To use JS/CC and for understanding its internals and behaviors, some knowledge of context-free grammars, bottom-up parsing techniques and compiler construction theory, in general, is assumed.

## DOCUMENTATION

For all documentation read the `jscc_manual.pdf` in doc/ folder.

## HOW TO USE
	
	node jscc.js [options] filename

## OPTIONS

	-h   --help               Print this usage help
	-i   --version            Print version and copyright
	-o   --output <file>      Save output source to <file>
	-p   --prefix <prefix>    Use <prefix> as sequence pre-fixing methods and variables
	-t   --template <file>    Use template file <file> as parser template (by default driver_node.js_  is located in root folder)
	-v   --verbose            Run in verbose mode
	-w   --warnings           Print warning messages
	-c   --compress           Compress output source using PACKER BASE62
	-s   --shrink             Shrink variables of output source using PACKER
	-cs  --compress-shrink    Shrink variables of output source and Compress output source
	-m   --minimize           Minimize output source using PACKER

## Samples

	For sample grammar see par/ folder.
	You will find
	- dragon.par : My own language (Implementation in progress...)
	- php.par    : PHP grammar from phype project (implementation of php in progress...)
	- ruby.par   : Ruby grammar from 8ball project (implementation of ruby in progress...)
	- calc.par   : Calculator grammar from JS/CC sample
	- xpl.par	 : Grammar for eXample Programming Language from JS/CC sample
