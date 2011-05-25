
/*
	Default template driver for JS/CC generated parsers running as
	browser-based JavaScript/ECMAScript applications.
	
	WARNING: 	This parser template will not run as console and has lesser
				features for debugging than the console derivates for the
				various JavaScript platforms.
	
	Features:
	- Parser trace messages
	- Integrated panic-mode error recovery
	
	Written 2007, 2008 by Jan Max Meyer, J.M.K S.F. Software Technologies
	
	This is in the public domain.
*/

var NODEJS__dbg_withtrace		= false;
var NODEJS__dbg_string			= new String();
if(NODEJS__dbg_withtrace){
	var fd = require("fs").openSync("NODEJS__dbg_withtrace.log", "w+");
	require('fs').writeSync(fd, new Date );
}
function __NODEJS_dbg_print( text )
{
	NODEJS__dbg_string += text + "\n";
}

function __NODEJS_lex( info )
{
	var state		= 0;
	var match		= -1;
	var match_pos	= 0;
	var start		= 0;
	var pos			= info.offset + 1;

	do
	{
		pos--;
		state = 0;
		match = -2;
		start = pos;

		if( info.src.length <= start )
			return 21;

		do
		{

switch( state )
{
	case 0:
		if( info.src.charCodeAt( pos ) == 9 || info.src.charCodeAt( pos ) == 32 ) state = 1;
		else if( info.src.charCodeAt( pos ) == 40 ) state = 2;
		else if( info.src.charCodeAt( pos ) == 41 ) state = 3;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 4;
		else if( info.src.charCodeAt( pos ) == 43 ) state = 5;
		else if( info.src.charCodeAt( pos ) == 45 ) state = 6;
		else if( info.src.charCodeAt( pos ) == 47 ) state = 7;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 8;
		else if( info.src.charCodeAt( pos ) == 94 ) state = 9;
		else if( info.src.charCodeAt( pos ) == 65 ) state = 19;
		else if( info.src.charCodeAt( pos ) == 67 ) state = 21;
		else if( info.src.charCodeAt( pos ) == 70 ) state = 22;
		else if( info.src.charCodeAt( pos ) == 77 ) state = 23;
		else if( info.src.charCodeAt( pos ) == 80 ) state = 24;
		else if( info.src.charCodeAt( pos ) == 82 ) state = 25;
		else if( info.src.charCodeAt( pos ) == 83 ) state = 26;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 6:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 7:
		state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 8:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 8;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 20;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 9:
		state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 10:
		state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 11:
		state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 12:
		state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 13:
		state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 14:
		state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 15:
		state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 16:
		state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 17:
		state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 18:
		state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 19:
		if( info.src.charCodeAt( pos ) == 66 ) state = 27;
		else state = -1;
		break;

	case 20:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 20;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 21:
		if( info.src.charCodeAt( pos ) == 69 ) state = 28;
		else state = -1;
		break;

	case 22:
		if( info.src.charCodeAt( pos ) == 76 ) state = 29;
		else state = -1;
		break;

	case 23:
		if( info.src.charCodeAt( pos ) == 65 ) state = 30;
		else if( info.src.charCodeAt( pos ) == 73 ) state = 31;
		else state = -1;
		break;

	case 24:
		if( info.src.charCodeAt( pos ) == 73 ) state = 10;
		else state = -1;
		break;

	case 25:
		if( info.src.charCodeAt( pos ) == 65 ) state = 32;
		else if( info.src.charCodeAt( pos ) == 79 ) state = 33;
		else state = -1;
		break;

	case 26:
		if( info.src.charCodeAt( pos ) == 81 ) state = 34;
		else state = -1;
		break;

	case 27:
		if( info.src.charCodeAt( pos ) == 83 ) state = 11;
		else state = -1;
		break;

	case 28:
		if( info.src.charCodeAt( pos ) == 73 ) state = 35;
		else state = -1;
		break;

	case 29:
		if( info.src.charCodeAt( pos ) == 79 ) state = 41;
		else state = -1;
		break;

	case 30:
		if( info.src.charCodeAt( pos ) == 88 ) state = 12;
		else state = -1;
		break;

	case 31:
		if( info.src.charCodeAt( pos ) == 78 ) state = 13;
		else state = -1;
		break;

	case 32:
		if( info.src.charCodeAt( pos ) == 78 ) state = 36;
		else state = -1;
		break;

	case 33:
		if( info.src.charCodeAt( pos ) == 85 ) state = 37;
		else state = -1;
		break;

	case 34:
		if( info.src.charCodeAt( pos ) == 82 ) state = 38;
		else state = -1;
		break;

	case 35:
		if( info.src.charCodeAt( pos ) == 76 ) state = 14;
		else state = -1;
		break;

	case 36:
		if( info.src.charCodeAt( pos ) == 68 ) state = 15;
		else state = -1;
		break;

	case 37:
		if( info.src.charCodeAt( pos ) == 78 ) state = 40;
		else state = -1;
		break;

	case 38:
		if( info.src.charCodeAt( pos ) == 84 ) state = 16;
		else state = -1;
		break;

	case 39:
		if( info.src.charCodeAt( pos ) == 82 ) state = 17;
		else state = -1;
		break;

	case 40:
		if( info.src.charCodeAt( pos ) == 68 ) state = 18;
		else state = -1;
		break;

	case 41:
		if( info.src.charCodeAt( pos ) == 79 ) state = 39;
		else state = -1;
		break;

}


			pos++;

		}
		while( state > -1 );

	}
	while( 1 > -1 && match == 1 );

	if( match > -1 )
	{
		info.att = info.src.substr( start, match_pos - start );
		info.offset = match_pos;
		
switch( match )
{
	case 4:
		{
		 info.att = parseFloat( info.att );	
		}
		break;

}


	}
	else
	{
		info.att = new String();
		match = -1;
	}

	return match;
}


function __NODEJS_parse( src, err_off, err_la )
{
	var		sstack			= new Array();
	var		vstack			= new Array();
	var 	err_cnt			= 0;
	var		act;
	var		go;
	var		la;
	var		rval;
	var 	parseinfo		= new Function( "", "var offset; var src; var att;" );
	var		info			= new parseinfo();
	
/* Pop-Table */
var pop_tab = new Array(
	new Array( 0/* p' */, 1 ),
	new Array( 20/* p */, 1 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 2 ),
	new Array( 19/* e */, 1 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 2 ),
	new Array( 19/* e */, 2 ),
	new Array( 19/* e */, 2 ),
	new Array( 19/* e */, 2 ),
	new Array( 19/* e */, 2 ),
	new Array( 19/* e */, 1 ),
	new Array( 19/* e */, 3 ),
	new Array( 19/* e */, 1 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 1 */ new Array( 21/* "$" */,0 ),
	/* State 2 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-1 ),
	/* State 3 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 4 */ new Array( 21/* "$" */,-8 , 14/* "+" */,-8 , 15/* "-" */,-8 , 16/* "^" */,-8 , 17/* "*" */,-8 , 18/* "/" */,-8 , 5/* "PI" */,-8 , 12/* "MAX" */,-8 , 13/* "MIN" */,-8 , 6/* "SQRT" */,-8 , 8/* "FLOOR" */,-8 , 9/* "CEIL" */,-8 , 7/* "ABS" */,-8 , 11/* "ROUND" */,-8 , 10/* "RAND" */,-8 , 2/* "(" */,-8 , 4/* "INT" */,-8 , 3/* ")" */,-8 ),
	/* State 5 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 6 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 7 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 8 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 9 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 10 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 11 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 12 */ new Array( 21/* "$" */,-16 , 14/* "+" */,-16 , 15/* "-" */,-16 , 16/* "^" */,-16 , 17/* "*" */,-16 , 18/* "/" */,-16 , 5/* "PI" */,-16 , 12/* "MAX" */,-16 , 13/* "MIN" */,-16 , 6/* "SQRT" */,-16 , 8/* "FLOOR" */,-16 , 9/* "CEIL" */,-16 , 7/* "ABS" */,-16 , 11/* "ROUND" */,-16 , 10/* "RAND" */,-16 , 2/* "(" */,-16 , 4/* "INT" */,-16 , 3/* ")" */,-16 ),
	/* State 13 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 14 */ new Array( 21/* "$" */,-18 , 14/* "+" */,-18 , 15/* "-" */,-18 , 16/* "^" */,-18 , 17/* "*" */,-18 , 18/* "/" */,-18 , 5/* "PI" */,-18 , 12/* "MAX" */,-18 , 13/* "MIN" */,-18 , 6/* "SQRT" */,-18 , 8/* "FLOOR" */,-18 , 9/* "CEIL" */,-18 , 7/* "ABS" */,-18 , 11/* "ROUND" */,-18 , 10/* "RAND" */,-18 , 2/* "(" */,-18 , 4/* "INT" */,-18 , 3/* ")" */,-18 ),
	/* State 15 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 16 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 17 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 18 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 19 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 20 */ new Array( 18/* "/" */,-7 , 17/* "*" */,-7 , 16/* "^" */,-7 , 15/* "-" */,-7 , 14/* "+" */,-7 , 21/* "$" */,-7 , 5/* "PI" */,-7 , 12/* "MAX" */,-7 , 13/* "MIN" */,-7 , 6/* "SQRT" */,-7 , 8/* "FLOOR" */,-7 , 9/* "CEIL" */,-7 , 7/* "ABS" */,-7 , 11/* "ROUND" */,-7 , 10/* "RAND" */,-7 , 2/* "(" */,-7 , 4/* "INT" */,-7 , 3/* ")" */,-7 ),
	/* State 21 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,34 , 14/* "+" */,19 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 22 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,34 , 14/* "+" */,19 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 23 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-11 , 5/* "PI" */,-11 , 12/* "MAX" */,-11 , 13/* "MIN" */,-11 , 6/* "SQRT" */,-11 , 8/* "FLOOR" */,-11 , 9/* "CEIL" */,-11 , 7/* "ABS" */,-11 , 11/* "ROUND" */,-11 , 10/* "RAND" */,-11 , 2/* "(" */,-11 , 4/* "INT" */,-11 , 3/* ")" */,-11 ),
	/* State 24 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-12 , 5/* "PI" */,-12 , 12/* "MAX" */,-12 , 13/* "MIN" */,-12 , 6/* "SQRT" */,-12 , 8/* "FLOOR" */,-12 , 9/* "CEIL" */,-12 , 7/* "ABS" */,-12 , 11/* "ROUND" */,-12 , 10/* "RAND" */,-12 , 2/* "(" */,-12 , 4/* "INT" */,-12 , 3/* ")" */,-12 ),
	/* State 25 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-13 , 5/* "PI" */,-13 , 12/* "MAX" */,-13 , 13/* "MIN" */,-13 , 6/* "SQRT" */,-13 , 8/* "FLOOR" */,-13 , 9/* "CEIL" */,-13 , 7/* "ABS" */,-13 , 11/* "ROUND" */,-13 , 10/* "RAND" */,-13 , 2/* "(" */,-13 , 4/* "INT" */,-13 , 3/* ")" */,-13 ),
	/* State 26 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-14 , 5/* "PI" */,-14 , 12/* "MAX" */,-14 , 13/* "MIN" */,-14 , 6/* "SQRT" */,-14 , 8/* "FLOOR" */,-14 , 9/* "CEIL" */,-14 , 7/* "ABS" */,-14 , 11/* "ROUND" */,-14 , 10/* "RAND" */,-14 , 2/* "(" */,-14 , 4/* "INT" */,-14 , 3/* ")" */,-14 ),
	/* State 27 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-15 , 5/* "PI" */,-15 , 12/* "MAX" */,-15 , 13/* "MIN" */,-15 , 6/* "SQRT" */,-15 , 8/* "FLOOR" */,-15 , 9/* "CEIL" */,-15 , 7/* "ABS" */,-15 , 11/* "ROUND" */,-15 , 10/* "RAND" */,-15 , 2/* "(" */,-15 , 4/* "INT" */,-15 , 3/* ")" */,-15 ),
	/* State 28 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 3/* ")" */,37 ),
	/* State 29 */ new Array( 18/* "/" */,-6 , 17/* "*" */,-6 , 16/* "^" */,-6 , 15/* "-" */,-6 , 14/* "+" */,-6 , 21/* "$" */,-6 , 5/* "PI" */,-6 , 12/* "MAX" */,-6 , 13/* "MIN" */,-6 , 6/* "SQRT" */,-6 , 8/* "FLOOR" */,-6 , 9/* "CEIL" */,-6 , 7/* "ABS" */,-6 , 11/* "ROUND" */,-6 , 10/* "RAND" */,-6 , 2/* "(" */,-6 , 4/* "INT" */,-6 , 3/* ")" */,-6 ),
	/* State 30 */ new Array( 18/* "/" */,-5 , 17/* "*" */,-5 , 16/* "^" */,-5 , 15/* "-" */,-5 , 14/* "+" */,-5 , 21/* "$" */,-5 , 5/* "PI" */,-5 , 12/* "MAX" */,-5 , 13/* "MIN" */,-5 , 6/* "SQRT" */,-5 , 8/* "FLOOR" */,-5 , 9/* "CEIL" */,-5 , 7/* "ABS" */,-5 , 11/* "ROUND" */,-5 , 10/* "RAND" */,-5 , 2/* "(" */,-5 , 4/* "INT" */,-5 , 3/* ")" */,-5 ),
	/* State 31 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,-4 , 15/* "-" */,-4 , 14/* "+" */,-4 , 21/* "$" */,-4 , 5/* "PI" */,-4 , 12/* "MAX" */,-4 , 13/* "MIN" */,-4 , 6/* "SQRT" */,-4 , 8/* "FLOOR" */,-4 , 9/* "CEIL" */,-4 , 7/* "ABS" */,-4 , 11/* "ROUND" */,-4 , 10/* "RAND" */,-4 , 2/* "(" */,-4 , 4/* "INT" */,-4 , 3/* ")" */,-4 ),
	/* State 32 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,-3 , 15/* "-" */,-3 , 14/* "+" */,-3 , 21/* "$" */,-3 , 5/* "PI" */,-3 , 12/* "MAX" */,-3 , 13/* "MIN" */,-3 , 6/* "SQRT" */,-3 , 8/* "FLOOR" */,-3 , 9/* "CEIL" */,-3 , 7/* "ABS" */,-3 , 11/* "ROUND" */,-3 , 10/* "RAND" */,-3 , 2/* "(" */,-3 , 4/* "INT" */,-3 , 3/* ")" */,-3 ),
	/* State 33 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,-2 , 15/* "-" */,-2 , 14/* "+" */,-2 , 21/* "$" */,-2 , 5/* "PI" */,-2 , 12/* "MAX" */,-2 , 13/* "MIN" */,-2 , 6/* "SQRT" */,-2 , 8/* "FLOOR" */,-2 , 9/* "CEIL" */,-2 , 7/* "ABS" */,-2 , 11/* "ROUND" */,-2 , 10/* "RAND" */,-2 , 2/* "(" */,-2 , 4/* "INT" */,-2 , 3/* ")" */,-2 ),
	/* State 34 */ new Array( 15/* "-" */,3 , 5/* "PI" */,4 , 12/* "MAX" */,5 , 13/* "MIN" */,6 , 6/* "SQRT" */,7 , 8/* "FLOOR" */,8 , 9/* "CEIL" */,9 , 7/* "ABS" */,10 , 11/* "ROUND" */,11 , 10/* "RAND" */,12 , 2/* "(" */,13 , 4/* "INT" */,14 ),
	/* State 35 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-9 , 5/* "PI" */,-9 , 12/* "MAX" */,-9 , 13/* "MIN" */,-9 , 6/* "SQRT" */,-9 , 8/* "FLOOR" */,-9 , 9/* "CEIL" */,-9 , 7/* "ABS" */,-9 , 11/* "ROUND" */,-9 , 10/* "RAND" */,-9 , 2/* "(" */,-9 , 4/* "INT" */,-9 , 3/* ")" */,-9 ),
	/* State 36 */ new Array( 18/* "/" */,15 , 17/* "*" */,16 , 16/* "^" */,17 , 15/* "-" */,18 , 14/* "+" */,19 , 21/* "$" */,-10 , 5/* "PI" */,-10 , 12/* "MAX" */,-10 , 13/* "MIN" */,-10 , 6/* "SQRT" */,-10 , 8/* "FLOOR" */,-10 , 9/* "CEIL" */,-10 , 7/* "ABS" */,-10 , 11/* "ROUND" */,-10 , 10/* "RAND" */,-10 , 2/* "(" */,-10 , 4/* "INT" */,-10 , 3/* ")" */,-10 ),
	/* State 37 */ new Array( 21/* "$" */,-17 , 14/* "+" */,-17 , 15/* "-" */,-17 , 16/* "^" */,-17 , 17/* "*" */,-17 , 18/* "/" */,-17 , 5/* "PI" */,-17 , 12/* "MAX" */,-17 , 13/* "MIN" */,-17 , 6/* "SQRT" */,-17 , 8/* "FLOOR" */,-17 , 9/* "CEIL" */,-17 , 7/* "ABS" */,-17 , 11/* "ROUND" */,-17 , 10/* "RAND" */,-17 , 2/* "(" */,-17 , 4/* "INT" */,-17 , 3/* ")" */,-17 ),
	/* State 38 */ new Array( 18/* "/" */,-3 , 17/* "*" */,-3 , 16/* "^" */,-3 , 15/* "-" */,-3 , 14/* "+" */,-3 , 21/* "$" */,-7 , 5/* "PI" */,-3 , 12/* "MAX" */,-3 , 13/* "MIN" */,-3 , 6/* "SQRT" */,-3 , 8/* "FLOOR" */,-3 , 9/* "CEIL" */,-3 , 7/* "ABS" */,-3 , 11/* "ROUND" */,-3 , 10/* "RAND" */,-3 , 2/* "(" */,-3 , 4/* "INT" */,-3 , 3/* ")" */,-7 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 20/* p */,1 , 19/* e */,2 ),
	/* State 1 */ new Array(  ),
	/* State 2 */ new Array(  ),
	/* State 3 */ new Array( 19/* e */,20 ),
	/* State 4 */ new Array(  ),
	/* State 5 */ new Array( 19/* e */,21 ),
	/* State 6 */ new Array( 19/* e */,22 ),
	/* State 7 */ new Array( 19/* e */,23 ),
	/* State 8 */ new Array( 19/* e */,24 ),
	/* State 9 */ new Array( 19/* e */,25 ),
	/* State 10 */ new Array( 19/* e */,26 ),
	/* State 11 */ new Array( 19/* e */,27 ),
	/* State 12 */ new Array(  ),
	/* State 13 */ new Array( 19/* e */,28 ),
	/* State 14 */ new Array(  ),
	/* State 15 */ new Array( 19/* e */,29 ),
	/* State 16 */ new Array( 19/* e */,30 ),
	/* State 17 */ new Array( 19/* e */,31 ),
	/* State 18 */ new Array( 19/* e */,32 ),
	/* State 19 */ new Array( 19/* e */,33 ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array( 19/* e */,35 ),
	/* State 22 */ new Array( 19/* e */,36 ),
	/* State 23 */ new Array(  ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array(  ),
	/* State 26 */ new Array(  ),
	/* State 27 */ new Array(  ),
	/* State 28 */ new Array(  ),
	/* State 29 */ new Array(  ),
	/* State 30 */ new Array(  ),
	/* State 31 */ new Array(  ),
	/* State 32 */ new Array(  ),
	/* State 33 */ new Array(  ),
	/* State 34 */ new Array( 19/* e */,38 ),
	/* State 35 */ new Array(  ),
	/* State 36 */ new Array(  ),
	/* State 37 */ new Array(  ),
	/* State 38 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"p'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"(" /* Terminal symbol */,
	")" /* Terminal symbol */,
	"INT" /* Terminal symbol */,
	"PI" /* Terminal symbol */,
	"SQRT" /* Terminal symbol */,
	"ABS" /* Terminal symbol */,
	"FLOOR" /* Terminal symbol */,
	"CEIL" /* Terminal symbol */,
	"RAND" /* Terminal symbol */,
	"ROUND" /* Terminal symbol */,
	"MAX" /* Terminal symbol */,
	"MIN" /* Terminal symbol */,
	"+" /* Terminal symbol */,
	"-" /* Terminal symbol */,
	"^" /* Terminal symbol */,
	"*" /* Terminal symbol */,
	"/" /* Terminal symbol */,
	"e" /* Non-terminal symbol */,
	"p" /* Non-terminal symbol */,
	"$" /* Terminal symbol */
);


	
	info.offset = 0;
	info.src = src;
	info.att = new String();
	
	if( !err_off )
		err_off	= new Array();
	if( !err_la )
	err_la = new Array();
	
	sstack.push( 0 );
	vstack.push( 0 );
	
	la = __NODEJS_lex( info );
	while( true )
	{
		act = 40;
		for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
		{
			if( act_tab[sstack[sstack.length-1]][i] == la )
			{
				act = act_tab[sstack[sstack.length-1]][i+1];
				break;
			}
		}

		if( NODEJS__dbg_withtrace && sstack.length > 0 )
		{
			__NODEJS_dbg_print( "\nState " + sstack[sstack.length-1] + "\n" +
							"\tLookahead: " + labels[la] + " (\"" + info.att + "\")\n" +
							"\tAction: " + act + "\n" + 
							"\tSource: \"" + info.src.substr( info.offset, 30 ) + ( ( info.offset + 30 < info.src.length ) ?
									"..." : "" ) + "\"\n" +
							"\tStack: " + sstack.join() + "\n" +
							"\tValue stack: " + vstack.join() + "\n" );
		}
		
			
		//Panic-mode: Try recovery when parse-error occurs!
		if( act == 40 )
		{
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "Error detected: There is no reduce or shift on the symbol " + labels[la] );
			
			err_cnt++;
			err_off.push( info.offset - info.att.length );			
			err_la.push( new Array() );
			for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
				err_la[err_la.length-1].push( labels[act_tab[sstack[sstack.length-1]][i]] );
			
			//Remember the original stack!
			var rsstack = new Array();
			var rvstack = new Array();
			for( var i = 0; i < sstack.length; i++ )
			{
				rsstack[i] = sstack[i];
				rvstack[i] = vstack[i];
			}
			
			while( act == 40 && la != 21 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery\n" +
									"Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
									"Action: " + act + "\n\n" );
				if( la == -1 )
					info.offset++;
					
				while( act == 40 && sstack.length > 0 )
				{
					sstack.pop();
					vstack.pop();
					
					if( sstack.length == 0 )
						break;
						
					act = 40;
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == la )
						{
							act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
				}
				
				if( act != 40 )
					break;
				
				for( var i = 0; i < rsstack.length; i++ )
				{
					sstack.push( rsstack[i] );
					vstack.push( rvstack[i] );
				}
				
				la = __NODEJS_lex( info );
			}
			
			if( act == 40 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery failed, terminating parse process..." );
				break;
			}


			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tError recovery succeeded, continuing" );
		}
		
		/*
		if( act == 40 )
			break;
		*/
		
		
		//Shift
		if( act > 0 )
		{			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "Shifting symbol: " + labels[la] + " (" + info.att + ")" );
		
			sstack.push( act );
			vstack.push( info.att );
			
			la = __NODEJS_lex( info );
			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tNew lookahead symbol: " + labels[la] + " (" + info.att + ")" );
		}
		//Reduce
		else
		{		
			act *= -1;
			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "Reducing by producution: " + act );
			
			rval = void(0);
			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tPerforming semantic action..." );
			
switch( act )
{
	case 0:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 1:
	{
		 console.log( vstack[ vstack.length - 1 ] );   				
	}
	break;
	case 2:
	{
		 rval = vstack[ vstack.length - 3 ] + vstack[ vstack.length - 1 ]; 				
	}
	break;
	case 3:
	{
		 rval = vstack[ vstack.length - 3 ] - vstack[ vstack.length - 1 ]; 				
	}
	break;
	case 4:
	{
		 rval = Math.pow(vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]);		
	}
	break;
	case 5:
	{
		 rval = vstack[ vstack.length - 3 ] * vstack[ vstack.length - 1 ]; 				
	}
	break;
	case 6:
	{
		 rval = vstack[ vstack.length - 3 ] / vstack[ vstack.length - 1 ]; 				
	}
	break;
	case 7:
	{
		 rval = vstack[ vstack.length - 1 ] * -1;				
	}
	break;
	case 8:
	{
		 rval = Math.PI; 				
	}
	break;
	case 9:
	{
		 rval = Math.max(vstack[ vstack.length - 2 ],vstack[ vstack.length - 1 ]);		
	}
	break;
	case 10:
	{
		 rval = Math.min(vstack[ vstack.length - 2 ],vstack[ vstack.length - 1 ]);		
	}
	break;
	case 11:
	{
		 rval = Math.sqrt(vstack[ vstack.length - 1 ]);			
	}
	break;
	case 12:
	{
		 rval = Math.floor(vstack[ vstack.length - 1 ]);			
	}
	break;
	case 13:
	{
		 rval = Math.ceil(vstack[ vstack.length - 1 ]);			
	}
	break;
	case 14:
	{
		 rval = Math.abs(vstack[ vstack.length - 1 ]);			
	}
	break;
	case 15:
	{
		 rval = Math.round(vstack[ vstack.length - 1 ]);			
	}
	break;
	case 16:
	{
		 rval = Math.random();			
	}
	break;
	case 17:
	{
		 rval = vstack[ vstack.length - 2 ]; 					
	}
	break;
	case 18:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
}



			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tPopping " + pop_tab[act][1] + " off the stack..." );
				
			for( var i = 0; i < pop_tab[act][1]; i++ )
			{
				sstack.pop();
				vstack.pop();
			}
									
			go = -1;
			for( var i = 0; i < goto_tab[sstack[sstack.length-1]].length; i+=2 )
			{
				if( goto_tab[sstack[sstack.length-1]][i] == pop_tab[act][0] )
				{
					go = goto_tab[sstack[sstack.length-1]][i+1];
					break;
				}
			}
			
			if( act == 0 )
				break;
				
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tPushing non-terminal " + labels[ pop_tab[act][0] ] );
				
			sstack.push( go );
			vstack.push( rval );			
		}
		
		if( NODEJS__dbg_withtrace )
		{	
				
			require('fs').writeSync(fd, NODEJS__dbg_string );
			NODEJS__dbg_string = new String();
		}
	}

	if( NODEJS__dbg_withtrace )
	{
		__NODEJS_dbg_print( "\nParse complete." );
		require('fs').writeSync(fd, NODEJS__dbg_string );
		NODEJS__dbg_string = new String();
	}
	
	return err_cnt;
}



	if(process.argv.length > 2) {
		var str = process.argv;
		delete str[0];
		delete str[1];
		str = str.join(" ");
		var error_cnt = 0;
		var error_off = new Array();
		var error_la = new Array();
	
		if((error_cnt = __NODEJS_parse(str, error_off, error_la)) > 0) {
		for(var i = 0; i < error_cnt; i++ ) {
			console.log( "Parse error near >" + str.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"" );
		}
		}
	}
	else {
		console.log( 'usage: proram <expr>' );
	}

