
//process.stdin.resume();
var read_string_exec = false,
  read_string_node = false ;
  
read_string = function(fn){
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', function (chunk) {
		 	fn(chunk);
		 	process.stdin.pause();
		});
};
//process.stdin.pause();
//Structs
function NODE()
{
	var type;
	var value;
	var children;
};

//Defines
var NODE_OP		= 0;
var NODE_VAR	= 1;
var NODE_CONST	= 2;

var OP_NONE		= -1;
var OP_ASSIGN	= 0;
var OP_IF		= 1;
var OP_IF_ELSE	= 2;
var OP_WHILE_DO	= 3;
var OP_DO_WHILE	= 4;
var OP_WRITE	= 5;
var OP_READ		= 6;
var OP_SAY		= 7;

var OP_EQU		= 10;
var OP_NEQ		= 11;
var OP_GRT		= 12;
var OP_LOT		= 13;
var OP_GRE		= 14;
var OP_LOE		= 15;
var OP_ADD		= 16;
var OP_SUB		= 17;
var OP_DIV		= 18;
var OP_MUL		= 19;
var OP_NEG		= 20;

//Management functions
function createNode( type, value, childs )
{
	var n = new NODE();
	n.type = type;
	n.value = value;	
	n.children = new Array();
	
	for( var i = 2; i < arguments.length; i++ )
		n.children.push( arguments[i] );
		
	return n;
}

var v_names = new Array();
var v_values = new Array();

//Interpreting function
function letvar( vname, value )
{
	var i;
	for( i = 0; i < v_names.length; i++ )
		if( v_names[i].toString() == vname.toString() )
			break;
		
	if( i == v_names.length )
	{
		v_names.push( vname );
		v_values.push( 0 );
	}
	
	v_values[i] = value;
}

function getvar( vname )
{
	var i;
	for( i = 0; i < v_names.length; i++ )
		if( v_names[i].toString() == vname.toString() )
			return v_values[i];
			
	return 0;
}

function execute( node )
{

	if(read_string_exec){
		process.nextTick(function(){try{execute( node );}catch(e){};},1000);
		throw "Wait";
	}
	var ret = 0;
	
	if( !node )
		return 0;
		
	switch( node.type )
	{
		case NODE_OP:
			switch( node.value )
			{
				case OP_NONE:
					if( node.children[0] )
						execute( node.children[0] );					
					if( node.children[1] )
						ret = execute( node.children[1] );
					break;
				case OP_ASSIGN:
					letvar( node.children[0], execute( node.children[1] ) );
					break;
				case OP_IF:
					if( execute( node.children[0] ) )
						execute( node.children[1] );
					break;
				case OP_IF_ELSE:
					if( execute( node.children[0] ) )
						execute( node.children[1] );
					else
						execute( node.children[2] );
					break;
				case OP_WHILE_DO:
					while( execute( node.children[0] ) )
						execute( node.children[1] );
					break;
				case OP_DO_WHILE:
					do
						execute( node.children[0] );
					while( execute( node.children[1] ) );
					break;
				case OP_WRITE:
					require('util').print( execute( node.children[0] ) );
					break;
				case OP_READ:
					read_string_exec = true;
					read_string(function(val){read_string_exec = false;letvar( node.children[0].toString(), val);});
					break;
				case OP_SAY:
					require('util').print( node.children[0].replace("\\n","\n") );
					break;
				case OP_EQU:
					ret = execute( node.children[0] ) == execute( node.children[1] );
					break;
				case OP_NEQ:
					ret = execute( node.children[0] ) != execute( node.children[1] );
					break;
				case OP_GRT:
					ret = execute( node.children[0] ) > execute( node.children[1] );
					break;
				case OP_LOT:
					ret = execute( node.children[0] ) < execute( node.children[1] );
					break;
				case OP_GRE:
					ret = execute( node.children[0] ) >= execute( node.children[1] );
					break;
				case OP_LOE:
					ret = execute( node.children[0] ) <= execute( node.children[1] );
					break;
				case OP_ADD:
					ret = execute( node.children[0] ) + execute( node.children[1] );
					break;
				case OP_SUB:
					ret = execute( node.children[0] ) - execute( node.children[1] );
					break;
				case OP_DIV:
					ret = execute( node.children[0] ) / execute( node.children[1] );
					break;
				case OP_MUL:
					ret = execute( node.children[0] ) * execute( node.children[1] );
					break;
				case OP_NEG:
					ret = execute( node.children[0] ) * -1;
					break;
			}
			break;
			
		case NODE_VAR:
			ret = Number( getvar( node.value ) );
			break;
			
		case NODE_CONST:
			ret = Number( node.value );
			break;
	}
	return ret;
}


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
			return 38;

		do
		{

switch( state )
{
	case 0:
		if( ( info.src.charCodeAt( pos ) >= 9 && info.src.charCodeAt( pos ) <= 10 ) || info.src.charCodeAt( pos ) == 13 || info.src.charCodeAt( pos ) == 32 ) state = 1;
		else if( info.src.charCodeAt( pos ) == 35 ) state = 2;
		else if( info.src.charCodeAt( pos ) == 40 ) state = 3;
		else if( info.src.charCodeAt( pos ) == 41 ) state = 4;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 5;
		else if( info.src.charCodeAt( pos ) == 43 ) state = 6;
		else if( info.src.charCodeAt( pos ) == 45 ) state = 7;
		else if( info.src.charCodeAt( pos ) == 47 ) state = 8;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 59 ) state = 10;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 11;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 12;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 13;
		else if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 15;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 16;
		else if( info.src.charCodeAt( pos ) == 33 ) state = 30;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 31;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 32;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 33;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 34;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 41;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 46;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 47;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 50;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 6:
		state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 7:
		state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 8:
		if( info.src.charCodeAt( pos ) == 47 ) state = 36;
		else state = -1;
		match = 21;
		match_pos = pos;
		break;

	case 9:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 19;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 10:
		state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 11:
		if( info.src.charCodeAt( pos ) == 61 ) state = 20;
		else state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 12:
		if( info.src.charCodeAt( pos ) == 61 ) state = 21;
		else state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 13:
		if( info.src.charCodeAt( pos ) == 61 ) state = 22;
		else state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 14:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 15:
		state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 16:
		state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 17:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 18:
		if( info.src.charCodeAt( pos ) == 39 ) state = 32;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 19:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 19;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 21:
		state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 22:
		state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 23:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 24:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 25:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 26:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 27:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 28:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 29:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 30:
		if( info.src.charCodeAt( pos ) == 61 ) state = 17;
		else state = -1;
		break;

	case 31:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 23;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 32:
		if( info.src.charCodeAt( pos ) == 39 ) state = 18;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 32;
		else state = -1;
		break;

	case 33:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 69 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 101 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 24;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 34:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 19;
		else state = -1;
		break;

	case 35:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 88 ) || info.src.charCodeAt( pos ) == 90 || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 120 ) || info.src.charCodeAt( pos ) == 122 ) state = 14;
		else if( info.src.charCodeAt( pos ) == 89 || info.src.charCodeAt( pos ) == 121 ) state = 25;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 36:
		if( info.src.charCodeAt( pos ) == 10 ) state = 1;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 9 ) || ( info.src.charCodeAt( pos ) >= 11 && info.src.charCodeAt( pos ) <= 254 ) ) state = 36;
		else state = -1;
		break;

	case 37:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 26;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 38:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 27;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 39:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 28;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 40:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 29;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 41:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 35;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 42:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 37;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 38;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 44:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 39;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 45:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 40;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 46:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 42;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 47:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 43;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 48:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 44;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 49:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 45;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 50:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 14;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 48;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 49;
		else state = -1;
		match = 26;
		match_pos = pos;
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
	case 27:
		{
		 info.att = info.att.substr( 1, info.att.length - 2 );
																	   info.att = info.att.replace( /''/g, "\'" );		
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
	new Array( 0/* Program' */, 1 ),
	new Array( 30/* Program */, 2 ),
	new Array( 30/* Program */, 0 ),
	new Array( 32/* Stmt_List */, 2 ),
	new Array( 32/* Stmt_List */, 0 ),
	new Array( 31/* Stmt */, 3 ),
	new Array( 31/* Stmt */, 5 ),
	new Array( 31/* Stmt */, 4 ),
	new Array( 31/* Stmt */, 5 ),
	new Array( 31/* Stmt */, 3 ),
	new Array( 31/* Stmt */, 3 ),
	new Array( 31/* Stmt */, 3 ),
	new Array( 31/* Stmt */, 4 ),
	new Array( 31/* Stmt */, 3 ),
	new Array( 31/* Stmt */, 1 ),
	new Array( 33/* Expression */, 3 ),
	new Array( 33/* Expression */, 3 ),
	new Array( 33/* Expression */, 3 ),
	new Array( 33/* Expression */, 3 ),
	new Array( 33/* Expression */, 3 ),
	new Array( 33/* Expression */, 3 ),
	new Array( 33/* Expression */, 1 ),
	new Array( 34/* AddSubExp */, 3 ),
	new Array( 34/* AddSubExp */, 3 ),
	new Array( 34/* AddSubExp */, 1 ),
	new Array( 35/* MulDivExp */, 3 ),
	new Array( 35/* MulDivExp */, 3 ),
	new Array( 35/* MulDivExp */, 1 ),
	new Array( 36/* NegExp */, 2 ),
	new Array( 36/* NegExp */, 1 ),
	new Array( 37/* Value */, 1 ),
	new Array( 37/* Value */, 1 ),
	new Array( 37/* Value */, 1 ),
	new Array( 37/* Value */, 3 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 38/* "$" */,-2 , 2/* "IF" */,-2 , 4/* "WHILE" */,-2 , 5/* "DO" */,-2 , 6/* "SAY" */,-2 , 7/* "WRITE" */,-2 , 8/* "READ" */,-2 , 26/* "Identifier" */,-2 , 9/* "{" */,-2 , 11/* ";" */,-2 ),
	/* State 1 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 6/* "SAY" */,6 , 7/* "WRITE" */,7 , 8/* "READ" */,8 , 26/* "Identifier" */,9 , 9/* "{" */,10 , 11/* ";" */,11 , 38/* "$" */,0 ),
	/* State 2 */ new Array( 38/* "$" */,-1 , 2/* "IF" */,-1 , 4/* "WHILE" */,-1 , 5/* "DO" */,-1 , 6/* "SAY" */,-1 , 7/* "WRITE" */,-1 , 8/* "READ" */,-1 , 26/* "Identifier" */,-1 , 9/* "{" */,-1 , 11/* ";" */,-1 ),
	/* State 3 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 4 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 5 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 6/* "SAY" */,6 , 7/* "WRITE" */,7 , 8/* "READ" */,8 , 26/* "Identifier" */,9 , 9/* "{" */,10 , 11/* ";" */,11 ),
	/* State 6 */ new Array( 27/* "String" */,24 ),
	/* State 7 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 8 */ new Array( 26/* "Identifier" */,26 ),
	/* State 9 */ new Array( 12/* "=" */,27 ),
	/* State 10 */ new Array( 10/* "}" */,-4 , 2/* "IF" */,-4 , 4/* "WHILE" */,-4 , 5/* "DO" */,-4 , 6/* "SAY" */,-4 , 7/* "WRITE" */,-4 , 8/* "READ" */,-4 , 26/* "Identifier" */,-4 , 9/* "{" */,-4 , 11/* ";" */,-4 ),
	/* State 11 */ new Array( 38/* "$" */,-14 , 2/* "IF" */,-14 , 4/* "WHILE" */,-14 , 5/* "DO" */,-14 , 6/* "SAY" */,-14 , 7/* "WRITE" */,-14 , 8/* "READ" */,-14 , 26/* "Identifier" */,-14 , 9/* "{" */,-14 , 11/* ";" */,-14 , 3/* "ELSE" */,-14 , 10/* "}" */,-14 ),
	/* State 12 */ new Array( 14/* "!=" */,29 , 16/* ">=" */,30 , 15/* "<=" */,31 , 17/* ">" */,32 , 18/* "<" */,33 , 13/* "==" */,34 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 6/* "SAY" */,6 , 7/* "WRITE" */,7 , 8/* "READ" */,8 , 26/* "Identifier" */,9 , 9/* "{" */,10 , 11/* ";" */,11 ),
	/* State 13 */ new Array( 19/* "+" */,36 , 20/* "-" */,37 , 2/* "IF" */,-21 , 4/* "WHILE" */,-21 , 5/* "DO" */,-21 , 6/* "SAY" */,-21 , 7/* "WRITE" */,-21 , 8/* "READ" */,-21 , 26/* "Identifier" */,-21 , 9/* "{" */,-21 , 11/* ";" */,-21 , 13/* "==" */,-21 , 18/* "<" */,-21 , 17/* ">" */,-21 , 15/* "<=" */,-21 , 16/* ">=" */,-21 , 14/* "!=" */,-21 , 24/* ")" */,-21 ),
	/* State 14 */ new Array( 21/* "/" */,38 , 22/* "*" */,39 , 2/* "IF" */,-24 , 4/* "WHILE" */,-24 , 5/* "DO" */,-24 , 6/* "SAY" */,-24 , 7/* "WRITE" */,-24 , 8/* "READ" */,-24 , 26/* "Identifier" */,-24 , 9/* "{" */,-24 , 11/* ";" */,-24 , 13/* "==" */,-24 , 18/* "<" */,-24 , 17/* ">" */,-24 , 15/* "<=" */,-24 , 16/* ">=" */,-24 , 14/* "!=" */,-24 , 20/* "-" */,-24 , 19/* "+" */,-24 , 24/* ")" */,-24 ),
	/* State 15 */ new Array( 2/* "IF" */,-27 , 4/* "WHILE" */,-27 , 5/* "DO" */,-27 , 6/* "SAY" */,-27 , 7/* "WRITE" */,-27 , 8/* "READ" */,-27 , 26/* "Identifier" */,-27 , 9/* "{" */,-27 , 11/* ";" */,-27 , 13/* "==" */,-27 , 18/* "<" */,-27 , 17/* ">" */,-27 , 15/* "<=" */,-27 , 16/* ">=" */,-27 , 14/* "!=" */,-27 , 20/* "-" */,-27 , 19/* "+" */,-27 , 22/* "*" */,-27 , 21/* "/" */,-27 , 24/* ")" */,-27 ),
	/* State 16 */ new Array( 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 17 */ new Array( 2/* "IF" */,-29 , 4/* "WHILE" */,-29 , 5/* "DO" */,-29 , 6/* "SAY" */,-29 , 7/* "WRITE" */,-29 , 8/* "READ" */,-29 , 26/* "Identifier" */,-29 , 9/* "{" */,-29 , 11/* ";" */,-29 , 13/* "==" */,-29 , 18/* "<" */,-29 , 17/* ">" */,-29 , 15/* "<=" */,-29 , 16/* ">=" */,-29 , 14/* "!=" */,-29 , 20/* "-" */,-29 , 19/* "+" */,-29 , 22/* "*" */,-29 , 21/* "/" */,-29 , 24/* ")" */,-29 ),
	/* State 18 */ new Array( 2/* "IF" */,-30 , 4/* "WHILE" */,-30 , 5/* "DO" */,-30 , 6/* "SAY" */,-30 , 7/* "WRITE" */,-30 , 8/* "READ" */,-30 , 26/* "Identifier" */,-30 , 9/* "{" */,-30 , 11/* ";" */,-30 , 13/* "==" */,-30 , 18/* "<" */,-30 , 17/* ">" */,-30 , 15/* "<=" */,-30 , 16/* ">=" */,-30 , 14/* "!=" */,-30 , 20/* "-" */,-30 , 19/* "+" */,-30 , 22/* "*" */,-30 , 21/* "/" */,-30 , 24/* ")" */,-30 ),
	/* State 19 */ new Array( 2/* "IF" */,-31 , 4/* "WHILE" */,-31 , 5/* "DO" */,-31 , 6/* "SAY" */,-31 , 7/* "WRITE" */,-31 , 8/* "READ" */,-31 , 26/* "Identifier" */,-31 , 9/* "{" */,-31 , 11/* ";" */,-31 , 13/* "==" */,-31 , 18/* "<" */,-31 , 17/* ">" */,-31 , 15/* "<=" */,-31 , 16/* ">=" */,-31 , 14/* "!=" */,-31 , 20/* "-" */,-31 , 19/* "+" */,-31 , 22/* "*" */,-31 , 21/* "/" */,-31 , 24/* ")" */,-31 ),
	/* State 20 */ new Array( 2/* "IF" */,-32 , 4/* "WHILE" */,-32 , 5/* "DO" */,-32 , 6/* "SAY" */,-32 , 7/* "WRITE" */,-32 , 8/* "READ" */,-32 , 26/* "Identifier" */,-32 , 9/* "{" */,-32 , 11/* ";" */,-32 , 13/* "==" */,-32 , 18/* "<" */,-32 , 17/* ">" */,-32 , 15/* "<=" */,-32 , 16/* ">=" */,-32 , 14/* "!=" */,-32 , 20/* "-" */,-32 , 19/* "+" */,-32 , 22/* "*" */,-32 , 21/* "/" */,-32 , 24/* ")" */,-32 ),
	/* State 21 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 22 */ new Array( 14/* "!=" */,29 , 16/* ">=" */,30 , 15/* "<=" */,31 , 17/* ">" */,32 , 18/* "<" */,33 , 13/* "==" */,34 , 5/* "DO" */,42 ),
	/* State 23 */ new Array( 4/* "WHILE" */,43 ),
	/* State 24 */ new Array( 11/* ";" */,44 ),
	/* State 25 */ new Array( 14/* "!=" */,29 , 16/* ">=" */,30 , 15/* "<=" */,31 , 17/* ">" */,32 , 18/* "<" */,33 , 13/* "==" */,34 , 11/* ";" */,45 ),
	/* State 26 */ new Array( 11/* ";" */,46 ),
	/* State 27 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 28 */ new Array( 10/* "}" */,49 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 6/* "SAY" */,6 , 7/* "WRITE" */,7 , 8/* "READ" */,8 , 26/* "Identifier" */,9 , 9/* "{" */,10 , 11/* ";" */,11 ),
	/* State 29 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 30 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 31 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 32 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 33 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 34 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 35 */ new Array( 3/* "ELSE" */,56 , 38/* "$" */,-5 , 2/* "IF" */,-5 , 4/* "WHILE" */,-5 , 5/* "DO" */,-5 , 6/* "SAY" */,-5 , 7/* "WRITE" */,-5 , 8/* "READ" */,-5 , 26/* "Identifier" */,-5 , 9/* "{" */,-5 , 11/* ";" */,-5 , 10/* "}" */,-5 ),
	/* State 36 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 37 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 38 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 39 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 40 */ new Array( 2/* "IF" */,-28 , 4/* "WHILE" */,-28 , 5/* "DO" */,-28 , 6/* "SAY" */,-28 , 7/* "WRITE" */,-28 , 8/* "READ" */,-28 , 26/* "Identifier" */,-28 , 9/* "{" */,-28 , 11/* ";" */,-28 , 13/* "==" */,-28 , 18/* "<" */,-28 , 17/* ">" */,-28 , 15/* "<=" */,-28 , 16/* ">=" */,-28 , 14/* "!=" */,-28 , 20/* "-" */,-28 , 19/* "+" */,-28 , 22/* "*" */,-28 , 21/* "/" */,-28 , 24/* ")" */,-28 ),
	/* State 41 */ new Array( 14/* "!=" */,29 , 16/* ">=" */,30 , 15/* "<=" */,31 , 17/* ">" */,32 , 18/* "<" */,33 , 13/* "==" */,34 , 24/* ")" */,61 ),
	/* State 42 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 6/* "SAY" */,6 , 7/* "WRITE" */,7 , 8/* "READ" */,8 , 26/* "Identifier" */,9 , 9/* "{" */,10 , 11/* ";" */,11 ),
	/* State 43 */ new Array( 20/* "-" */,16 , 28/* "Integer" */,18 , 29/* "Float" */,19 , 26/* "Identifier" */,20 , 23/* "(" */,21 ),
	/* State 44 */ new Array( 38/* "$" */,-9 , 2/* "IF" */,-9 , 4/* "WHILE" */,-9 , 5/* "DO" */,-9 , 6/* "SAY" */,-9 , 7/* "WRITE" */,-9 , 8/* "READ" */,-9 , 26/* "Identifier" */,-9 , 9/* "{" */,-9 , 11/* ";" */,-9 , 3/* "ELSE" */,-9 , 10/* "}" */,-9 ),
	/* State 45 */ new Array( 38/* "$" */,-10 , 2/* "IF" */,-10 , 4/* "WHILE" */,-10 , 5/* "DO" */,-10 , 6/* "SAY" */,-10 , 7/* "WRITE" */,-10 , 8/* "READ" */,-10 , 26/* "Identifier" */,-10 , 9/* "{" */,-10 , 11/* ";" */,-10 , 3/* "ELSE" */,-10 , 10/* "}" */,-10 ),
	/* State 46 */ new Array( 38/* "$" */,-11 , 2/* "IF" */,-11 , 4/* "WHILE" */,-11 , 5/* "DO" */,-11 , 6/* "SAY" */,-11 , 7/* "WRITE" */,-11 , 8/* "READ" */,-11 , 26/* "Identifier" */,-11 , 9/* "{" */,-11 , 11/* ";" */,-11 , 3/* "ELSE" */,-11 , 10/* "}" */,-11 ),
	/* State 47 */ new Array( 14/* "!=" */,29 , 16/* ">=" */,30 , 15/* "<=" */,31 , 17/* ">" */,32 , 18/* "<" */,33 , 13/* "==" */,34 , 11/* ";" */,64 ),
	/* State 48 */ new Array( 10/* "}" */,-3 , 2/* "IF" */,-3 , 4/* "WHILE" */,-3 , 5/* "DO" */,-3 , 6/* "SAY" */,-3 , 7/* "WRITE" */,-3 , 8/* "READ" */,-3 , 26/* "Identifier" */,-3 , 9/* "{" */,-3 , 11/* ";" */,-3 ),
	/* State 49 */ new Array( 38/* "$" */,-13 , 2/* "IF" */,-13 , 4/* "WHILE" */,-13 , 5/* "DO" */,-13 , 6/* "SAY" */,-13 , 7/* "WRITE" */,-13 , 8/* "READ" */,-13 , 26/* "Identifier" */,-13 , 9/* "{" */,-13 , 11/* ";" */,-13 , 3/* "ELSE" */,-13 , 10/* "}" */,-13 ),
	/* State 50 */ new Array( 19/* "+" */,36 , 20/* "-" */,37 , 2/* "IF" */,-20 , 4/* "WHILE" */,-20 , 5/* "DO" */,-20 , 6/* "SAY" */,-20 , 7/* "WRITE" */,-20 , 8/* "READ" */,-20 , 26/* "Identifier" */,-20 , 9/* "{" */,-20 , 11/* ";" */,-20 , 13/* "==" */,-20 , 18/* "<" */,-20 , 17/* ">" */,-20 , 15/* "<=" */,-20 , 16/* ">=" */,-20 , 14/* "!=" */,-20 , 24/* ")" */,-20 ),
	/* State 51 */ new Array( 19/* "+" */,36 , 20/* "-" */,37 , 2/* "IF" */,-19 , 4/* "WHILE" */,-19 , 5/* "DO" */,-19 , 6/* "SAY" */,-19 , 7/* "WRITE" */,-19 , 8/* "READ" */,-19 , 26/* "Identifier" */,-19 , 9/* "{" */,-19 , 11/* ";" */,-19 , 13/* "==" */,-19 , 18/* "<" */,-19 , 17/* ">" */,-19 , 15/* "<=" */,-19 , 16/* ">=" */,-19 , 14/* "!=" */,-19 , 24/* ")" */,-19 ),
	/* State 52 */ new Array( 19/* "+" */,36 , 20/* "-" */,37 , 2/* "IF" */,-18 , 4/* "WHILE" */,-18 , 5/* "DO" */,-18 , 6/* "SAY" */,-18 , 7/* "WRITE" */,-18 , 8/* "READ" */,-18 , 26/* "Identifier" */,-18 , 9/* "{" */,-18 , 11/* ";" */,-18 , 13/* "==" */,-18 , 18/* "<" */,-18 , 17/* ">" */,-18 , 15/* "<=" */,-18 , 16/* ">=" */,-18 , 14/* "!=" */,-18 , 24/* ")" */,-18 ),
	/* State 53 */ new Array( 19/* "+" */,36 , 20/* "-" */,37 , 2/* "IF" */,-17 , 4/* "WHILE" */,-17 , 5/* "DO" */,-17 , 6/* "SAY" */,-17 , 7/* "WRITE" */,-17 , 8/* "READ" */,-17 , 26/* "Identifier" */,-17 , 9/* "{" */,-17 , 11/* ";" */,-17 , 13/* "==" */,-17 , 18/* "<" */,-17 , 17/* ">" */,-17 , 15/* "<=" */,-17 , 16/* ">=" */,-17 , 14/* "!=" */,-17 , 24/* ")" */,-17 ),
	/* State 54 */ new Array( 19/* "+" */,36 , 20/* "-" */,37 , 2/* "IF" */,-16 , 4/* "WHILE" */,-16 , 5/* "DO" */,-16 , 6/* "SAY" */,-16 , 7/* "WRITE" */,-16 , 8/* "READ" */,-16 , 26/* "Identifier" */,-16 , 9/* "{" */,-16 , 11/* ";" */,-16 , 13/* "==" */,-16 , 18/* "<" */,-16 , 17/* ">" */,-16 , 15/* "<=" */,-16 , 16/* ">=" */,-16 , 14/* "!=" */,-16 , 24/* ")" */,-16 ),
	/* State 55 */ new Array( 19/* "+" */,36 , 20/* "-" */,37 , 2/* "IF" */,-15 , 4/* "WHILE" */,-15 , 5/* "DO" */,-15 , 6/* "SAY" */,-15 , 7/* "WRITE" */,-15 , 8/* "READ" */,-15 , 26/* "Identifier" */,-15 , 9/* "{" */,-15 , 11/* ";" */,-15 , 13/* "==" */,-15 , 18/* "<" */,-15 , 17/* ">" */,-15 , 15/* "<=" */,-15 , 16/* ">=" */,-15 , 14/* "!=" */,-15 , 24/* ")" */,-15 ),
	/* State 56 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 6/* "SAY" */,6 , 7/* "WRITE" */,7 , 8/* "READ" */,8 , 26/* "Identifier" */,9 , 9/* "{" */,10 , 11/* ";" */,11 ),
	/* State 57 */ new Array( 21/* "/" */,38 , 22/* "*" */,39 , 2/* "IF" */,-23 , 4/* "WHILE" */,-23 , 5/* "DO" */,-23 , 6/* "SAY" */,-23 , 7/* "WRITE" */,-23 , 8/* "READ" */,-23 , 26/* "Identifier" */,-23 , 9/* "{" */,-23 , 11/* ";" */,-23 , 13/* "==" */,-23 , 18/* "<" */,-23 , 17/* ">" */,-23 , 15/* "<=" */,-23 , 16/* ">=" */,-23 , 14/* "!=" */,-23 , 20/* "-" */,-23 , 19/* "+" */,-23 , 24/* ")" */,-23 ),
	/* State 58 */ new Array( 21/* "/" */,38 , 22/* "*" */,39 , 2/* "IF" */,-22 , 4/* "WHILE" */,-22 , 5/* "DO" */,-22 , 6/* "SAY" */,-22 , 7/* "WRITE" */,-22 , 8/* "READ" */,-22 , 26/* "Identifier" */,-22 , 9/* "{" */,-22 , 11/* ";" */,-22 , 13/* "==" */,-22 , 18/* "<" */,-22 , 17/* ">" */,-22 , 15/* "<=" */,-22 , 16/* ">=" */,-22 , 14/* "!=" */,-22 , 20/* "-" */,-22 , 19/* "+" */,-22 , 24/* ")" */,-22 ),
	/* State 59 */ new Array( 2/* "IF" */,-26 , 4/* "WHILE" */,-26 , 5/* "DO" */,-26 , 6/* "SAY" */,-26 , 7/* "WRITE" */,-26 , 8/* "READ" */,-26 , 26/* "Identifier" */,-26 , 9/* "{" */,-26 , 11/* ";" */,-26 , 13/* "==" */,-26 , 18/* "<" */,-26 , 17/* ">" */,-26 , 15/* "<=" */,-26 , 16/* ">=" */,-26 , 14/* "!=" */,-26 , 20/* "-" */,-26 , 19/* "+" */,-26 , 22/* "*" */,-26 , 21/* "/" */,-26 , 24/* ")" */,-26 ),
	/* State 60 */ new Array( 2/* "IF" */,-25 , 4/* "WHILE" */,-25 , 5/* "DO" */,-25 , 6/* "SAY" */,-25 , 7/* "WRITE" */,-25 , 8/* "READ" */,-25 , 26/* "Identifier" */,-25 , 9/* "{" */,-25 , 11/* ";" */,-25 , 13/* "==" */,-25 , 18/* "<" */,-25 , 17/* ">" */,-25 , 15/* "<=" */,-25 , 16/* ">=" */,-25 , 14/* "!=" */,-25 , 20/* "-" */,-25 , 19/* "+" */,-25 , 22/* "*" */,-25 , 21/* "/" */,-25 , 24/* ")" */,-25 ),
	/* State 61 */ new Array( 2/* "IF" */,-33 , 4/* "WHILE" */,-33 , 5/* "DO" */,-33 , 6/* "SAY" */,-33 , 7/* "WRITE" */,-33 , 8/* "READ" */,-33 , 26/* "Identifier" */,-33 , 9/* "{" */,-33 , 11/* ";" */,-33 , 13/* "==" */,-33 , 18/* "<" */,-33 , 17/* ">" */,-33 , 15/* "<=" */,-33 , 16/* ">=" */,-33 , 14/* "!=" */,-33 , 20/* "-" */,-33 , 19/* "+" */,-33 , 22/* "*" */,-33 , 21/* "/" */,-33 , 24/* ")" */,-33 ),
	/* State 62 */ new Array( 38/* "$" */,-7 , 2/* "IF" */,-7 , 4/* "WHILE" */,-7 , 5/* "DO" */,-7 , 6/* "SAY" */,-7 , 7/* "WRITE" */,-7 , 8/* "READ" */,-7 , 26/* "Identifier" */,-7 , 9/* "{" */,-7 , 11/* ";" */,-7 , 3/* "ELSE" */,-7 , 10/* "}" */,-7 ),
	/* State 63 */ new Array( 14/* "!=" */,29 , 16/* ">=" */,30 , 15/* "<=" */,31 , 17/* ">" */,32 , 18/* "<" */,33 , 13/* "==" */,34 , 11/* ";" */,66 ),
	/* State 64 */ new Array( 38/* "$" */,-12 , 2/* "IF" */,-12 , 4/* "WHILE" */,-12 , 5/* "DO" */,-12 , 6/* "SAY" */,-12 , 7/* "WRITE" */,-12 , 8/* "READ" */,-12 , 26/* "Identifier" */,-12 , 9/* "{" */,-12 , 11/* ";" */,-12 , 3/* "ELSE" */,-12 , 10/* "}" */,-12 ),
	/* State 65 */ new Array( 38/* "$" */,-6 , 2/* "IF" */,-6 , 4/* "WHILE" */,-6 , 5/* "DO" */,-6 , 6/* "SAY" */,-6 , 7/* "WRITE" */,-6 , 8/* "READ" */,-6 , 26/* "Identifier" */,-6 , 9/* "{" */,-6 , 11/* ";" */,-6 , 3/* "ELSE" */,-6 , 10/* "}" */,-6 ),
	/* State 66 */ new Array( 38/* "$" */,-8 , 2/* "IF" */,-8 , 4/* "WHILE" */,-8 , 5/* "DO" */,-8 , 6/* "SAY" */,-8 , 7/* "WRITE" */,-8 , 8/* "READ" */,-8 , 26/* "Identifier" */,-8 , 9/* "{" */,-8 , 11/* ";" */,-8 , 3/* "ELSE" */,-8 , 10/* "}" */,-8 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 30/* Program */,1 ),
	/* State 1 */ new Array( 31/* Stmt */,2 ),
	/* State 2 */ new Array(  ),
	/* State 3 */ new Array( 33/* Expression */,12 , 34/* AddSubExp */,13 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 4 */ new Array( 33/* Expression */,22 , 34/* AddSubExp */,13 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 5 */ new Array( 31/* Stmt */,23 ),
	/* State 6 */ new Array(  ),
	/* State 7 */ new Array( 33/* Expression */,25 , 34/* AddSubExp */,13 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 8 */ new Array(  ),
	/* State 9 */ new Array(  ),
	/* State 10 */ new Array( 32/* Stmt_List */,28 ),
	/* State 11 */ new Array(  ),
	/* State 12 */ new Array( 31/* Stmt */,35 ),
	/* State 13 */ new Array(  ),
	/* State 14 */ new Array(  ),
	/* State 15 */ new Array(  ),
	/* State 16 */ new Array( 37/* Value */,40 ),
	/* State 17 */ new Array(  ),
	/* State 18 */ new Array(  ),
	/* State 19 */ new Array(  ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array( 33/* Expression */,41 , 34/* AddSubExp */,13 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array(  ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array(  ),
	/* State 26 */ new Array(  ),
	/* State 27 */ new Array( 33/* Expression */,47 , 34/* AddSubExp */,13 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 28 */ new Array( 31/* Stmt */,48 ),
	/* State 29 */ new Array( 34/* AddSubExp */,50 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 30 */ new Array( 34/* AddSubExp */,51 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 31 */ new Array( 34/* AddSubExp */,52 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 32 */ new Array( 34/* AddSubExp */,53 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 33 */ new Array( 34/* AddSubExp */,54 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 34 */ new Array( 34/* AddSubExp */,55 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 35 */ new Array(  ),
	/* State 36 */ new Array( 35/* MulDivExp */,57 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 37 */ new Array( 35/* MulDivExp */,58 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 38 */ new Array( 36/* NegExp */,59 , 37/* Value */,17 ),
	/* State 39 */ new Array( 36/* NegExp */,60 , 37/* Value */,17 ),
	/* State 40 */ new Array(  ),
	/* State 41 */ new Array(  ),
	/* State 42 */ new Array( 31/* Stmt */,62 ),
	/* State 43 */ new Array( 33/* Expression */,63 , 34/* AddSubExp */,13 , 35/* MulDivExp */,14 , 36/* NegExp */,15 , 37/* Value */,17 ),
	/* State 44 */ new Array(  ),
	/* State 45 */ new Array(  ),
	/* State 46 */ new Array(  ),
	/* State 47 */ new Array(  ),
	/* State 48 */ new Array(  ),
	/* State 49 */ new Array(  ),
	/* State 50 */ new Array(  ),
	/* State 51 */ new Array(  ),
	/* State 52 */ new Array(  ),
	/* State 53 */ new Array(  ),
	/* State 54 */ new Array(  ),
	/* State 55 */ new Array(  ),
	/* State 56 */ new Array( 31/* Stmt */,65 ),
	/* State 57 */ new Array(  ),
	/* State 58 */ new Array(  ),
	/* State 59 */ new Array(  ),
	/* State 60 */ new Array(  ),
	/* State 61 */ new Array(  ),
	/* State 62 */ new Array(  ),
	/* State 63 */ new Array(  ),
	/* State 64 */ new Array(  ),
	/* State 65 */ new Array(  ),
	/* State 66 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"Program'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"IF" /* Terminal symbol */,
	"ELSE" /* Terminal symbol */,
	"WHILE" /* Terminal symbol */,
	"DO" /* Terminal symbol */,
	"SAY" /* Terminal symbol */,
	"WRITE" /* Terminal symbol */,
	"READ" /* Terminal symbol */,
	"{" /* Terminal symbol */,
	"}" /* Terminal symbol */,
	";" /* Terminal symbol */,
	"=" /* Terminal symbol */,
	"==" /* Terminal symbol */,
	"!=" /* Terminal symbol */,
	"<=" /* Terminal symbol */,
	">=" /* Terminal symbol */,
	">" /* Terminal symbol */,
	"<" /* Terminal symbol */,
	"+" /* Terminal symbol */,
	"-" /* Terminal symbol */,
	"/" /* Terminal symbol */,
	"*" /* Terminal symbol */,
	"(" /* Terminal symbol */,
	")" /* Terminal symbol */,
	"#" /* Terminal symbol */,
	"Identifier" /* Terminal symbol */,
	"String" /* Terminal symbol */,
	"Integer" /* Terminal symbol */,
	"Float" /* Terminal symbol */,
	"Program" /* Non-terminal symbol */,
	"Stmt" /* Non-terminal symbol */,
	"Stmt_List" /* Non-terminal symbol */,
	"Expression" /* Non-terminal symbol */,
	"AddSubExp" /* Non-terminal symbol */,
	"MulDivExp" /* Non-terminal symbol */,
	"NegExp" /* Non-terminal symbol */,
	"Value" /* Non-terminal symbol */,
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
		act = 68;
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
		if( act == 68 )
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
			
			while( act == 68 && la != 38 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery\n" +
									"Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
									"Action: " + act + "\n\n" );
				if( la == -1 )
					info.offset++;
					
				while( act == 68 && sstack.length > 0 )
				{
					sstack.pop();
					vstack.pop();
					
					if( sstack.length == 0 )
						break;
						
					act = 68;
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == la )
						{
							act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
				}
				
				if( act != 68 )
					break;
				
				for( var i = 0; i < rsstack.length; i++ )
				{
					sstack.push( rsstack[i] );
					vstack.push( rvstack[i] );
				}
				
				la = __NODEJS_lex( info );
			}
			
			if( act == 68 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery failed, terminating parse process..." );
				break;
			}


			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tError recovery succeeded, continuing" );
		}
		
		/*
		if( act == 68 )
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
		 try{execute( vstack[ vstack.length - 1 ] );}catch(e){}; 
	}
	break;
	case 2:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 3:
	{
		 rval = createNode( NODE_OP, OP_NONE, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 4:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 5:
	{
		 rval = createNode( NODE_OP, OP_IF, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 6:
	{
		 rval = createNode( NODE_OP, OP_IF_ELSE, vstack[ vstack.length - 4 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 7:
	{
		 rval = createNode( NODE_OP, OP_WHILE_DO, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 8:
	{
		 rval = createNode( NODE_OP, OP_DO_WHILE, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 9:
	{
		 rval = createNode( NODE_OP, OP_SAY, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 10:
	{
		 rval = createNode( NODE_OP, OP_WRITE, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 11:
	{
		 rval = createNode( NODE_OP, OP_READ, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 12:
	{
		 rval = createNode( NODE_OP, OP_ASSIGN, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 13:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 14:
	{
		 rval = createNode( NODE_OP, OP_NONE ); 
	}
	break;
	case 15:
	{
		 rval = createNode( NODE_OP, OP_EQU, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 16:
	{
		 rval = createNode( NODE_OP, OP_LOT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 17:
	{
		 rval = createNode( NODE_OP, OP_GRT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 18:
	{
		 rval = createNode( NODE_OP, OP_LOE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 19:
	{
		 rval = createNode( NODE_OP, OP_GRE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 20:
	{
		 rval = createNode( NODE_OP, OP_NEQ, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 21:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 22:
	{
		 rval = createNode( NODE_OP, OP_SUB, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 23:
	{
		 rval = createNode( NODE_OP, OP_ADD, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 24:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 25:
	{
		 rval = createNode( NODE_OP, OP_MUL, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 26:
	{
		 rval = createNode( NODE_OP, OP_DIV, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 27:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 28:
	{
		 rval = createNode( NODE_OP, OP_NEG, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 29:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 30:
	{
		 rval = createNode( NODE_CONST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 31:
	{
		 rval = createNode( NODE_CONST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 32:
	{
		 rval = createNode( NODE_VAR, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 33:
	{
		 rval = vstack[ vstack.length - 2 ]; 
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



	if(process.argv.length == 3) {
		var str = require("fs").readFileSync( process.argv[2] ).toString("utf-8");
		var error_cnt = 0;
		var error_off = new Array();
		var error_la = new Array();
	
		if((error_cnt = __NODEJS_parse(str, error_off, error_la)) > 0) {
		    var i;
			for( i = 0; i < error_cnt; i++ ) {
				console.log( "Parse error near >" + str.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"" );
			}
		}
	}
	else {
		console.log( 'usage: proram <filename>' );
	}

