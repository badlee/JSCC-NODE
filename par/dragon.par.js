

//Structs
function NODE()
{
	var type;
	var value;
	var children;
}

//Defines
var NODE_OP	= 0;
var NODE_VAR	= 1;
var NODE_CONST	= 2;
var NODE_STRING	= 3;
var NODE_FLOAT	= 4;
var NODE_OPERATOR = 5;
var NODE_BOOLEAN = 6;

var OPERATOR_PRE = 0;
var OPERATOR_POST = 1;
var OPERATOR_BOTH = 2;

var OP_NONE	= -1;
var OP_ASSIGN	= 0;
var OP_IF	= 1;
var OP_IF_ELSE	= 2;
var OP_WHILE_DO	= 3;
var OP_DO_WHILE	= 4;
var OP_PROTOTYPE	= 5;
var OP_IMPORT	= 6;
var OP_ECHO	= 7;

var OP_EQU	= 10;
var OP_NEQ	= 11;
var OP_GRT	= 12;
var OP_LOT	= 13;
var OP_GRE	= 14;
var OP_LOE	= 15;
var OP_ADD	= 16;
var OP_SUB	= 17;
var OP_DIV	= 18;
var OP_MUL	= 19;
var OP_NEG	= 20;
var OP_NOT	= 21;
var OP_MODULO = 22;
var OP_BITD = 23;
var OP_BITG = 24;

var OP_TAIRNAIRE	= 30;
var OP_BINAIRE		= 31;
var OP_FOR			= 32;
var OP_FORIN		= 33;
var OP_INCR_POST	= 34;
var OP_INCR_PRE		= 35;
var OP_DECR_POST	= 36;
var OP_DECR_PRE		= 37;
var OP_CODE			= 38;
var OP_FUNCTION		= 39;

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

var v_names = new Array("true","false","null","NaN");
var v_values = new Array(true,false,null,NaN);
/*
	Gestion des variables
*/

function drgVar(name){
	this.name = name || "";
	this.readOnly = false; //lecture seul
	this.protect = false; //protege contre l'ajout d'enfant
	this.val = null; //valeur de la variable
	this.code = null; //code executable portant le nom de la variable
	this.fn = null; //function executable portant le nom de la variable
	this.prototype = null; //type de donnée portant le nom de la variable
	
	/*
		example prototype
		SMS from type{
			_init = function(){
				//validator function
			};
			operator = {
				+ = function(type,b){
					
				};
				- = function(type,b){
					
				};
				* = function(type,b){
					
				};
				/ = function(type,b){
					
				};
			}
			Static = {
				someFn=function(){
					//some code
				},
				someAttr : //somevalue
			}
		}
	*/
	this.propretie = {
		"this" : this
	};
}
drgVar.prototype = {
	setReadOnly : function(b){
		return this.readOnly = !!b;
	},
	setProp : function(b,val,readOnly){
		if(b){
			//inssensible à la case
			b = b.toLowerCase();
			var p = b.split(".");
			var i=p[0];
			delete p[0];
			p = p.filter(function(a){return a;}).join(".");
			if(this.propretie[i] && p!==''){
				return this.propretie[i].setProp(p,val,readOnly);
			}else if(this.propretie[i] && p===''){
				if(val!==undefined)
					this.propretie[i].setVal(val);
				this.propretie[i].setReadOnly(readOnly);
				return this.propretie[i].getVal();
			}else if(p==''){
				if(this.protect) return null;
				this.propretie[i] = new drgVar(i);
				if(val!==undefined)
					this.propretie[i].setVal(val);
				this.propretie[i].setReadOnly(readOnly);
				return this.propretie[i].getVal();
			}
		}
		return null;
	},
	getProp: function(b){
		if(b){
			//inssensible à la case
			b = b.toLowerCase();
			var p = b.split(".");
			var i=p[0];
			delete p[0];
			p = p.filter(function(a){return a;}).join(".");
			if(this.propretie[i] && p!==''){
				return this.propretie[i].getProp(p);
			}else if(this.propretie[i] && p===''){
				return this.propretie[i].getVal();
			}
		}
		return null;
	},
	getVal : function(){
		return this.val;
	},
	setVal : function(v){
		if(this.readOnly) return v;
		return this.val = v===undefined ? null: v;
	},
	getFn : function(){
		return this.fn;
	},
	setFn : function(v){
		if(this.readOnly) return v;
		return this.fn = v===undefined ? null: v;
	},
	getCode : function(){
		return this.code;
	},
	setCode : function(v){
		if(this.readOnly) return v;
		return this.code = v===undefined ? null: v;
	},
	getPrototype : function(){
		return this.fn;
	},
	setPrototype : function(v){
		if(this.readOnly) return v;
		if(this.prototype) return this.prototype;
		return this.prototype = v===undefined ? null: v;
	},
};
var _global = new drgVar("global");
_global.setReadOnly(true);
//Interpreting function
function letvar( vname, value , readOnly)
{
	return _global.setProp(vname, value , readOnly || false)
}

function getvar( vname )
{
	return _global.getProp(vname);
}
letvar( "true", true , true);
letvar( "false", false , true);
letvar( "NaN", NaN , true);
letvar( "null", null , true);
/*Just for dragon operator define*/
//operator +
Number.prototype["+"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return this+1;
			break;
		case OPERATOR_BOTH:
			return this+b;
			break;
	}
};
String.prototype["+"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return this+"";
			break;
		case OPERATOR_BOTH:
			return this+b;
			break;
	}
};
Boolean.prototype["+"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return !!this;
			break;
		case OPERATOR_BOTH:
			return this&&b;
			break;
	}
};
//operator -
Number.prototype["-"] = function (type,b){
	switch(type){
		case OPERATOR_POST:
			return -1*this;
			break;
		case OPERATOR_PRE:
			return this-1;
			break;
		case OPERATOR_BOTH:
			return this-b;
			break;
	}
};
Boolean.prototype["-"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
			return !this;
			break;
		case OPERATOR_PRE:
			return false;
			break;
		case OPERATOR_BOTH:
			return this && !b;
			break;
	}
};
//operator *
Number.prototype[ "*" ] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this * b;
			break;
	}
};
Boolean.prototype[ "*" ] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this || b;
			break;
	}
};
//operator /
Number.prototype["/"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
			return 1/this;
			break;
		case OPERATOR_PRE:
			return this/1;
			break;
		case OPERATOR_BOTH:
			return this / b;
			break;
	}
};
Boolean.prototype["/"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return !!this;
			break;
		case OPERATOR_BOTH:
			return this || !b;
			break;
	}
};
//operator %
Number.prototype["%"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this % b;
			break;
	}
};
//operator &&
Number.prototype["&&"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this && b;
			break;
	}
};
String.prototype["&&"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this && b;
			break;
	}
};
Boolean.prototype["&&"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this && b;
			break;
	}
};
//operator ||
Number.prototype["||"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this || b;
			break;
	}
};
String.prototype["||"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this || b;
			break;
	}
};
Boolean.prototype["||"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this || b;
			break;
	}
};
//operator >
Number.prototype[">"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this > b;
			break;
	}
};
String.prototype[">"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this > b;
			break;
	}
};
Boolean.prototype[">"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this > b;
			break;
	}
};
//operator <
Number.prototype["<"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this < b;
			break;
	}
};
String.prototype["<"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this < b;
			break;
	}
};
Boolean.prototype["<"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this < b;
			break;
	}

};
//operator >=
Number.prototype[">="] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this >= b;
			break;
	}
};
String.prototype[">="] = function(type,b){	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this >= b;
			break;
	}
};
Boolean.prototype[">="] = function(type,b){	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this >= b;
			break;
	}
};
//operator !=
Number.prototype["!="] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this != b;
			break;
	}

};
String.prototype["!="] = function(type,b){	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this != b;
			break;
	}
};
Boolean.prototype["!="] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this != b;
			break;
	}
};
//operator <=
Number.prototype["<="] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this <= b;
			break;
	}
};
String.prototype["<="] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this <= b;
			break;
	}
};
Boolean.prototype["<="] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return null;
			break;
		case OPERATOR_BOTH:
			return this <= b;
			break;
	}
};
//operator !
Number.prototype["!"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return !this;
			break;
		case OPERATOR_BOTH:
			return this != b;
			break;
	}
};
String.prototype["!"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return !this;
			break;
		case OPERATOR_BOTH:
			return this != b;
			break;
	}
};
Boolean.prototype["!"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
		case OPERATOR_PRE:
			return !this;
			break;
		case OPERATOR_BOTH:
			return this != b;
			break;
	}
};
//operator <<
Number.prototype["<<"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
			return 1<<this;
			break;
		case OPERATOR_PRE:
			return this<<1;
			break;
		case OPERATOR_BOTH:
			return this << b;
			break;
	}
};

//operator >>
Number.prototype[">>"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
			return 1>>this;
			break;
		case OPERATOR_PRE:
			return this>>1;
			break;
		case OPERATOR_BOTH:
			return this >> b;
			break;
	}
};
//operator §
String.prototype["§"] = function(type,b){
	switch(type){
		case OPERATOR_POST:
			break;
		case OPERATOR_PRE:
			break;
		case OPERATOR_BOTH:
			letvar(this , b);
			break;
	}
	return getvar(this);
};

function execute( node )
{
	var ret = null;
	
	if( !node )
		return null;
	switch( node.type )
	{
		case NODE_OP:
			switch( node.value )
			{
				case OP_NONE:
					if( node.children[0] )
						ret = execute( node.children[0] );					
					if( node.children[1] )
						ret = execute( node.children[1] );
					break;
				case OP_INCR_PRE:
					ret = getvar(node.children[0]);
					try{
						letvar( node.children[0], ret[ "+" ](OPERATOR_BOTH,1) );
					}catch(e){
						ret = null;
					}
					break;
				case OP_INCR_POST:
					try{
						ret = getvar(node.children[0])[ "+" ](OPERATOR_BOTH,1);
					}catch(e){
						ret = null;
					}
					letvar( node.children[0], ret );
					break;
				case OP_DECR_PRE:
					ret = getvar(node.children[0]);
					try{
						letvar( node.children[0], ret[ "-" ](OPERATOR_BOTH,1) );
					}catch(e){
						ret = null;
					}
					break;
				case OP_DECR_POST:
					try{
						ret = getvar(node.children[0])[ "-" ](OPERATOR_BOTH,1);
					}catch(e){
						ret = null;
					}
					letvar( node.children[0], ret );
					break;
				case OP_ASSIGN:
					letvar( node.children[0], execute( node.children[1] ) );
					ret = getvar(node.children[0]);
					break;
				case OP_BINAIRE:
					if( !execute( node.children[0] ) )
						letvar( node.children[1], execute( node.children[2] ) );
					ret = execute( node.children[1]);
					break;
				case OP_TAIRNAIRE:
					if( execute( node.children[0] ) )
						ret = execute( node.children[1] );
					else
						ret = execute( node.children[2] );
					break;
				case OP_IF:
					if( execute( node.children[0] ) )
						ret = execute( node.children[1] );
					break;
				case OP_IF_ELSE:
					if( execute( node.children[0] ) )
						ret = execute( node.children[1] );
					else
						execute( node.children[2] );
					break;
				case OP_WHILE_DO:
					while( ret = execute( node.children[0] ) )
						execute( node.children[1] );
					break;
				case OP_FOR:
					for(execute( node.children[0] );execute( node.children[1] );ret = execute( node.children[2] )){
						execute( node.children[3] );
					}
					break;
				case OP_DO_WHILE:
					do
						execute( node.children[0] );
					while( ret = execute( node.children[1] ) );
					break;
				case OP_ECHO:
					console.log(ret =  execute(node.children[0]) );
					break;
			}
			break;
			
		case NODE_VAR:
			ret = getvar( node.value );
			break;
			
		case NODE_CONST:
			ret = parseInt( node.value );
			break;
		case NODE_BOOLEAN:
			ret = Boolean( node.value );
			break;
		case NODE_STRING:
			ret = String( node.value );
			break;
		
		case NODE_FLOAT:
			ret = parseFloat( node.value );
			break;
		case NODE_OPERATOR:
			try{
				if(node.children[2]){
					ret = execute( node.children[1] )[node.children[0]](OPERATOR_BOTH,execute( node.children[2] ));
				}else{
					node.value = (node.value==2 || node.value==0) ? OPERATOR_PRE:OPERATOR_POST;
					ret = execute( node.children[1] )[node.children[0]](node.value);
				}
			}catch(e){
				ret = null;
			}
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
			return 43;

		do
		{

switch( state )
{
	case 0:
		if( ( info.src.charCodeAt( pos ) >= 9 && info.src.charCodeAt( pos ) <= 10 ) || info.src.charCodeAt( pos ) == 13 || info.src.charCodeAt( pos ) == 32 ) state = 1;
		else if( info.src.charCodeAt( pos ) == 33 ) state = 2;
		else if( info.src.charCodeAt( pos ) == 35 ) state = 3;
		else if( info.src.charCodeAt( pos ) == 40 ) state = 4;
		else if( info.src.charCodeAt( pos ) == 41 ) state = 5;
		else if( info.src.charCodeAt( pos ) == 44 ) state = 6;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 7;
		else if( info.src.charCodeAt( pos ) == 58 ) state = 8;
		else if( info.src.charCodeAt( pos ) == 59 ) state = 9;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 10;
		else if( info.src.charCodeAt( pos ) == 63 ) state = 11;
		else if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 79 ) || ( info.src.charCodeAt( pos ) >= 81 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 111 ) || ( info.src.charCodeAt( pos ) >= 113 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 13;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 14;
		else if( info.src.charCodeAt( pos ) == 34 ) state = 31;
		else if( ( info.src.charCodeAt( pos ) >= 36 && info.src.charCodeAt( pos ) <= 37 ) || info.src.charCodeAt( pos ) == 42 || info.src.charCodeAt( pos ) == 64 || info.src.charCodeAt( pos ) == 92 || info.src.charCodeAt( pos ) == 94 || info.src.charCodeAt( pos ) == 96 || info.src.charCodeAt( pos ) == 126 || info.src.charCodeAt( pos ) == 167 || info.src.charCodeAt( pos ) == 176 ) state = 33;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 34;
		else if( info.src.charCodeAt( pos ) == 38 ) state = 35;
		else if( info.src.charCodeAt( pos ) == 43 ) state = 36;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 37;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 38;
		else if( info.src.charCodeAt( pos ) == 45 ) state = 39;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 41;
		else if( info.src.charCodeAt( pos ) == 47 ) state = 42;
		else if( info.src.charCodeAt( pos ) == 124 ) state = 44;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 45;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 48;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 55;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 62;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 63;
		else if( info.src.charCodeAt( pos ) == 80 || info.src.charCodeAt( pos ) == 112 ) state = 67;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 68;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		if( info.src.charCodeAt( pos ) == 61 ) state = 33;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 6:
		state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 7:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 7;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 19;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 8:
		if( info.src.charCodeAt( pos ) == 58 ) state = 33;
		else state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 9:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 10:
		if( ( info.src.charCodeAt( pos ) >= 61 && info.src.charCodeAt( pos ) <= 62 ) ) state = 33;
		else state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 11:
		if( info.src.charCodeAt( pos ) == 58 ) state = 20;
		else state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 12:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 13:
		state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 14:
		state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 15:
		state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 16:
		state = -1;
		match = 21;
		match_pos = pos;
		break;

	case 17:
		state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 18:
		state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 19:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 19;
		else state = -1;
		match = 30;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 21:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 22:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 23:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 24:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 25:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 26:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 27:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 28:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 29:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 30:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 31:
		if( info.src.charCodeAt( pos ) == 34 ) state = 15;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 33 ) || ( info.src.charCodeAt( pos ) >= 35 && info.src.charCodeAt( pos ) <= 254 ) ) state = 31;
		else state = -1;
		break;

	case 32:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 254 ) ) state = 32;
		else state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 33:
		state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 34:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 21;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 35:
		if( info.src.charCodeAt( pos ) == 38 ) state = 33;
		else state = -1;
		break;

	case 36:
		if( info.src.charCodeAt( pos ) == 43 ) state = 16;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 37:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 69 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 101 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 22;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 23;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 38:
		if( info.src.charCodeAt( pos ) == 39 ) state = 15;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 38;
		else state = -1;
		break;

	case 39:
		if( info.src.charCodeAt( pos ) == 45 ) state = 17;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 33;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 40:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 24;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 41:
		if( info.src.charCodeAt( pos ) == 46 ) state = 18;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 19;
		else state = -1;
		break;

	case 42:
		if( info.src.charCodeAt( pos ) == 47 ) state = 32;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 47;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 25;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 44:
		if( info.src.charCodeAt( pos ) == 124 ) state = 33;
		else state = -1;
		break;

	case 45:
		if( ( info.src.charCodeAt( pos ) >= 60 && info.src.charCodeAt( pos ) <= 61 ) ) state = 33;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 46:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 26;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 47:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 41 ) || ( info.src.charCodeAt( pos ) >= 43 && info.src.charCodeAt( pos ) <= 46 ) || ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 254 ) ) state = 47;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 52;
		else state = -1;
		break;

	case 48:
		if( ( info.src.charCodeAt( pos ) >= 61 && info.src.charCodeAt( pos ) <= 62 ) ) state = 33;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 49:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 27;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 50:
		if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else state = -1;
		break;

	case 51:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 28;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 52:
		if( info.src.charCodeAt( pos ) == 47 ) state = 1;
		else state = -1;
		break;

	case 53:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 29;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 54:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 30;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 55:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 40;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 71;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 56:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 43;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 57:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 46;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 58:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 49;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 59:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 51;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 60:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 53;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 61:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 54;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 62:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 56;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 63:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 57;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 58;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 64:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 59;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 65:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 60;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 66:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 61;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 67:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 64;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 68:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 65;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 69:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 66;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 70:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 69;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 71:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 12;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 70;
		else state = -1;
		match = 27;
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
	case 28:
		{
		
											info.att = info.att.substr(1,info.att.length-2);
											info.att = info.att.replace( /\\'/g, "'" );
										
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
	new Array( 31/* Program */, 2 ),
	new Array( 31/* Program */, 0 ),
	new Array( 33/* Stmt_List */, 2 ),
	new Array( 33/* Stmt_List */, 0 ),
	new Array( 32/* Stmt */, 5 ),
	new Array( 32/* Stmt */, 7 ),
	new Array( 32/* Stmt */, 7 ),
	new Array( 32/* Stmt */, 5 ),
	new Array( 32/* Stmt */, 9 ),
	new Array( 32/* Stmt */, 7 ),
	new Array( 32/* Stmt */, 3 ),
	new Array( 32/* Stmt */, 3 ),
	new Array( 32/* Stmt */, 1 ),
	new Array( 32/* Stmt */, 3 ),
	new Array( 32/* Stmt */, 1 ),
	new Array( 34/* Expression */, 0 ),
	new Array( 34/* Expression */, 5 ),
	new Array( 34/* Expression */, 1 ),
	new Array( 34/* Expression */, 1 ),
	new Array( 34/* Expression */, 1 ),
	new Array( 34/* Expression */, 2 ),
	new Array( 34/* Expression */, 2 ),
	new Array( 34/* Expression */, 2 ),
	new Array( 34/* Expression */, 2 ),
	new Array( 34/* Expression */, 2 ),
	new Array( 34/* Expression */, 2 ),
	new Array( 34/* Expression */, 3 ),
	new Array( 34/* Expression */, 1 ),
	new Array( 35/* Constructor */, 5 ),
	new Array( 35/* Constructor */, 6 ),
	new Array( 35/* Constructor */, 4 ),
	new Array( 35/* Constructor */, 5 ),
	new Array( 39/* LARGS */, 3 ),
	new Array( 39/* LARGS */, 0 ),
	new Array( 40/* ARGS */, 1 ),
	new Array( 40/* ARGS */, 1 ),
	new Array( 36/* Callable */, 4 ),
	new Array( 41/* LValue */, 3 ),
	new Array( 41/* LValue */, 1 ),
	new Array( 37/* Assign */, 3 ),
	new Array( 37/* Assign */, 5 ),
	new Array( 38/* Value */, 1 ),
	new Array( 38/* Value */, 1 ),
	new Array( 38/* Value */, 1 ),
	new Array( 38/* Value */, 1 ),
	new Array( 38/* Value */, 3 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 43/* "$" */,-2 , 2/* "IF" */,-2 , 5/* "DO" */,-2 , 4/* "WHILE" */,-2 , 6/* "FOR" */,-2 , 8/* "ECHO" */,-2 , 9/* "PRINT" */,-2 , 12/* "{" */,-2 , 17/* ";" */,-2 , 14/* "?" */,-2 , 21/* "++" */,-2 , 27/* "Identifier" */,-2 , 22/* "--" */,-2 , 26/* "operator" */,-2 , 10/* "CODE" */,-2 , 11/* "FUNCTION" */,-2 , 29/* "Integer" */,-2 , 30/* "Float" */,-2 , 28/* "String" */,-2 , 23/* "(" */,-2 ),
	/* State 1 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,0 , 14/* "?" */,-16 ),
	/* State 2 */ new Array( 43/* "$" */,-1 , 2/* "IF" */,-1 , 5/* "DO" */,-1 , 4/* "WHILE" */,-1 , 6/* "FOR" */,-1 , 8/* "ECHO" */,-1 , 9/* "PRINT" */,-1 , 12/* "{" */,-1 , 17/* ";" */,-1 , 14/* "?" */,-1 , 21/* "++" */,-1 , 27/* "Identifier" */,-1 , 22/* "--" */,-1 , 26/* "operator" */,-1 , 10/* "CODE" */,-1 , 11/* "FUNCTION" */,-1 , 29/* "Integer" */,-1 , 30/* "Float" */,-1 , 28/* "String" */,-1 , 23/* "(" */,-1 ),
	/* State 3 */ new Array( 23/* "(" */,26 ),
	/* State 4 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 14/* "?" */,-16 ),
	/* State 5 */ new Array( 23/* "(" */,28 ),
	/* State 6 */ new Array( 23/* "(" */,29 ),
	/* State 7 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 17/* ";" */,-16 , 14/* "?" */,-16 ),
	/* State 8 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 17/* ";" */,-16 , 14/* "?" */,-16 ),
	/* State 9 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 43/* "$" */,-13 , 2/* "IF" */,-13 , 5/* "DO" */,-13 , 4/* "WHILE" */,-13 , 6/* "FOR" */,-13 , 8/* "ECHO" */,-13 , 9/* "PRINT" */,-13 , 12/* "{" */,-13 , 17/* ";" */,-13 , 21/* "++" */,-13 , 27/* "Identifier" */,-13 , 22/* "--" */,-13 , 10/* "CODE" */,-13 , 11/* "FUNCTION" */,-13 , 29/* "Integer" */,-13 , 30/* "Float" */,-13 , 28/* "String" */,-13 , 23/* "(" */,-13 , 13/* "}" */,-13 , 24/* ")" */,-13 , 15/* ":" */,-13 , 16/* "?:" */,-13 , 3/* "ELSE" */,-13 , 18/* "," */,-13 ),
	/* State 10 */ new Array( 13/* "}" */,-4 , 2/* "IF" */,-4 , 5/* "DO" */,-4 , 4/* "WHILE" */,-4 , 6/* "FOR" */,-4 , 8/* "ECHO" */,-4 , 9/* "PRINT" */,-4 , 12/* "{" */,-4 , 17/* ";" */,-4 , 14/* "?" */,-4 , 21/* "++" */,-4 , 27/* "Identifier" */,-4 , 22/* "--" */,-4 , 26/* "operator" */,-4 , 10/* "CODE" */,-4 , 11/* "FUNCTION" */,-4 , 29/* "Integer" */,-4 , 30/* "Float" */,-4 , 28/* "String" */,-4 , 23/* "(" */,-4 ),
	/* State 11 */ new Array( 43/* "$" */,-15 , 2/* "IF" */,-15 , 5/* "DO" */,-15 , 4/* "WHILE" */,-15 , 6/* "FOR" */,-15 , 8/* "ECHO" */,-15 , 9/* "PRINT" */,-15 , 12/* "{" */,-15 , 17/* ";" */,-15 , 14/* "?" */,-15 , 21/* "++" */,-15 , 27/* "Identifier" */,-15 , 22/* "--" */,-15 , 26/* "operator" */,-15 , 10/* "CODE" */,-15 , 11/* "FUNCTION" */,-15 , 29/* "Integer" */,-15 , 30/* "Float" */,-15 , 28/* "String" */,-15 , 23/* "(" */,-15 , 13/* "}" */,-15 , 24/* ")" */,-15 , 15/* ":" */,-15 , 16/* "?:" */,-15 , 3/* "ELSE" */,-15 , 18/* "," */,-15 ),
	/* State 12 */ new Array( 43/* "$" */,-18 , 2/* "IF" */,-18 , 5/* "DO" */,-18 , 4/* "WHILE" */,-18 , 6/* "FOR" */,-18 , 8/* "ECHO" */,-18 , 9/* "PRINT" */,-18 , 12/* "{" */,-18 , 17/* ";" */,-18 , 14/* "?" */,-18 , 21/* "++" */,-18 , 27/* "Identifier" */,-18 , 22/* "--" */,-18 , 26/* "operator" */,-18 , 10/* "CODE" */,-18 , 11/* "FUNCTION" */,-18 , 29/* "Integer" */,-18 , 30/* "Float" */,-18 , 28/* "String" */,-18 , 23/* "(" */,-18 , 24/* ")" */,-18 , 15/* ":" */,-18 , 13/* "}" */,-18 , 16/* "?:" */,-18 , 3/* "ELSE" */,-18 , 18/* "," */,-18 ),
	/* State 13 */ new Array( 43/* "$" */,-19 , 2/* "IF" */,-19 , 5/* "DO" */,-19 , 4/* "WHILE" */,-19 , 6/* "FOR" */,-19 , 8/* "ECHO" */,-19 , 9/* "PRINT" */,-19 , 12/* "{" */,-19 , 17/* ";" */,-19 , 14/* "?" */,-19 , 21/* "++" */,-19 , 27/* "Identifier" */,-19 , 22/* "--" */,-19 , 26/* "operator" */,-19 , 10/* "CODE" */,-19 , 11/* "FUNCTION" */,-19 , 29/* "Integer" */,-19 , 30/* "Float" */,-19 , 28/* "String" */,-19 , 23/* "(" */,-19 , 24/* ")" */,-19 , 15/* ":" */,-19 , 13/* "}" */,-19 , 16/* "?:" */,-19 , 3/* "ELSE" */,-19 , 18/* "," */,-19 ),
	/* State 14 */ new Array( 43/* "$" */,-20 , 2/* "IF" */,-20 , 5/* "DO" */,-20 , 4/* "WHILE" */,-20 , 6/* "FOR" */,-20 , 8/* "ECHO" */,-20 , 9/* "PRINT" */,-20 , 12/* "{" */,-20 , 17/* ";" */,-20 , 14/* "?" */,-20 , 21/* "++" */,-20 , 27/* "Identifier" */,-20 , 22/* "--" */,-20 , 26/* "operator" */,-20 , 10/* "CODE" */,-20 , 11/* "FUNCTION" */,-20 , 29/* "Integer" */,-20 , 30/* "Float" */,-20 , 28/* "String" */,-20 , 23/* "(" */,-20 , 24/* ")" */,-20 , 15/* ":" */,-20 , 13/* "}" */,-20 , 16/* "?:" */,-20 , 3/* "ELSE" */,-20 , 18/* "," */,-20 ),
	/* State 15 */ new Array( 27/* "Identifier" */,35 ),
	/* State 16 */ new Array( 20/* "=" */,36 , 23/* "(" */,37 , 22/* "--" */,38 , 21/* "++" */,39 , 43/* "$" */,-45 , 2/* "IF" */,-45 , 5/* "DO" */,-45 , 4/* "WHILE" */,-45 , 6/* "FOR" */,-45 , 8/* "ECHO" */,-45 , 9/* "PRINT" */,-45 , 12/* "{" */,-45 , 17/* ";" */,-45 , 14/* "?" */,-45 , 27/* "Identifier" */,-45 , 26/* "operator" */,-45 , 10/* "CODE" */,-45 , 11/* "FUNCTION" */,-45 , 29/* "Integer" */,-45 , 30/* "Float" */,-45 , 28/* "String" */,-45 , 24/* ")" */,-45 , 15/* ":" */,-45 , 13/* "}" */,-45 , 16/* "?:" */,-45 , 3/* "ELSE" */,-45 , 18/* "," */,-45 ),
	/* State 17 */ new Array( 27/* "Identifier" */,40 ),
	/* State 18 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 2/* "IF" */,-16 , 5/* "DO" */,-16 , 4/* "WHILE" */,-16 , 6/* "FOR" */,-16 , 8/* "ECHO" */,-16 , 9/* "PRINT" */,-16 , 12/* "{" */,-16 , 17/* ";" */,-16 , 14/* "?" */,-16 ),
	/* State 19 */ new Array( 43/* "$" */,-28 , 2/* "IF" */,-28 , 5/* "DO" */,-28 , 4/* "WHILE" */,-28 , 6/* "FOR" */,-28 , 8/* "ECHO" */,-28 , 9/* "PRINT" */,-28 , 12/* "{" */,-28 , 17/* ";" */,-28 , 14/* "?" */,-28 , 21/* "++" */,-28 , 27/* "Identifier" */,-28 , 22/* "--" */,-28 , 26/* "operator" */,-28 , 10/* "CODE" */,-28 , 11/* "FUNCTION" */,-28 , 29/* "Integer" */,-28 , 30/* "Float" */,-28 , 28/* "String" */,-28 , 23/* "(" */,-28 , 24/* ")" */,-28 , 15/* ":" */,-28 , 13/* "}" */,-28 , 16/* "?:" */,-28 , 3/* "ELSE" */,-28 , 18/* "," */,-28 ),
	/* State 20 */ new Array( 23/* "(" */,42 , 27/* "Identifier" */,43 ),
	/* State 21 */ new Array( 23/* "(" */,44 , 27/* "Identifier" */,45 ),
	/* State 22 */ new Array( 43/* "$" */,-42 , 2/* "IF" */,-42 , 5/* "DO" */,-42 , 4/* "WHILE" */,-42 , 6/* "FOR" */,-42 , 8/* "ECHO" */,-42 , 9/* "PRINT" */,-42 , 12/* "{" */,-42 , 17/* ";" */,-42 , 14/* "?" */,-42 , 21/* "++" */,-42 , 27/* "Identifier" */,-42 , 22/* "--" */,-42 , 26/* "operator" */,-42 , 10/* "CODE" */,-42 , 11/* "FUNCTION" */,-42 , 29/* "Integer" */,-42 , 30/* "Float" */,-42 , 28/* "String" */,-42 , 23/* "(" */,-42 , 24/* ")" */,-42 , 15/* ":" */,-42 , 13/* "}" */,-42 , 16/* "?:" */,-42 , 3/* "ELSE" */,-42 , 18/* "," */,-42 ),
	/* State 23 */ new Array( 43/* "$" */,-43 , 2/* "IF" */,-43 , 5/* "DO" */,-43 , 4/* "WHILE" */,-43 , 6/* "FOR" */,-43 , 8/* "ECHO" */,-43 , 9/* "PRINT" */,-43 , 12/* "{" */,-43 , 17/* ";" */,-43 , 14/* "?" */,-43 , 21/* "++" */,-43 , 27/* "Identifier" */,-43 , 22/* "--" */,-43 , 26/* "operator" */,-43 , 10/* "CODE" */,-43 , 11/* "FUNCTION" */,-43 , 29/* "Integer" */,-43 , 30/* "Float" */,-43 , 28/* "String" */,-43 , 23/* "(" */,-43 , 24/* ")" */,-43 , 15/* ":" */,-43 , 13/* "}" */,-43 , 16/* "?:" */,-43 , 3/* "ELSE" */,-43 , 18/* "," */,-43 ),
	/* State 24 */ new Array( 43/* "$" */,-44 , 2/* "IF" */,-44 , 5/* "DO" */,-44 , 4/* "WHILE" */,-44 , 6/* "FOR" */,-44 , 8/* "ECHO" */,-44 , 9/* "PRINT" */,-44 , 12/* "{" */,-44 , 17/* ";" */,-44 , 14/* "?" */,-44 , 21/* "++" */,-44 , 27/* "Identifier" */,-44 , 22/* "--" */,-44 , 26/* "operator" */,-44 , 10/* "CODE" */,-44 , 11/* "FUNCTION" */,-44 , 29/* "Integer" */,-44 , 30/* "Float" */,-44 , 28/* "String" */,-44 , 23/* "(" */,-44 , 24/* ")" */,-44 , 15/* ":" */,-44 , 13/* "}" */,-44 , 16/* "?:" */,-44 , 3/* "ELSE" */,-44 , 18/* "," */,-44 ),
	/* State 25 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 24/* ")" */,-16 , 14/* "?" */,-16 ),
	/* State 26 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 24/* ")" */,-16 , 14/* "?" */,-16 ),
	/* State 27 */ new Array( 4/* "WHILE" */,48 ),
	/* State 28 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 24/* ")" */,-16 , 14/* "?" */,-16 ),
	/* State 29 */ new Array( 27/* "Identifier" */,51 , 21/* "++" */,15 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 17/* ";" */,-16 , 14/* "?" */,-16 ),
	/* State 30 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 17/* ";" */,52 ),
	/* State 31 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 17/* ";" */,53 ),
	/* State 32 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 2/* "IF" */,-16 , 5/* "DO" */,-16 , 4/* "WHILE" */,-16 , 6/* "FOR" */,-16 , 8/* "ECHO" */,-16 , 9/* "PRINT" */,-16 , 12/* "{" */,-16 , 17/* ";" */,-16 , 14/* "?" */,-16 , 13/* "}" */,-26 , 24/* ")" */,-26 , 15/* ":" */,-26 , 16/* "?:" */,-26 , 3/* "ELSE" */,-26 , 18/* "," */,-26 ),
	/* State 33 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 15/* ":" */,-16 , 14/* "?" */,-16 ),
	/* State 34 */ new Array( 13/* "}" */,57 , 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 14/* "?" */,-16 ),
	/* State 35 */ new Array( 43/* "$" */,-21 , 2/* "IF" */,-21 , 5/* "DO" */,-21 , 4/* "WHILE" */,-21 , 6/* "FOR" */,-21 , 8/* "ECHO" */,-21 , 9/* "PRINT" */,-21 , 12/* "{" */,-21 , 17/* ";" */,-21 , 14/* "?" */,-21 , 21/* "++" */,-21 , 27/* "Identifier" */,-21 , 22/* "--" */,-21 , 26/* "operator" */,-21 , 10/* "CODE" */,-21 , 11/* "FUNCTION" */,-21 , 29/* "Integer" */,-21 , 30/* "Float" */,-21 , 28/* "String" */,-21 , 23/* "(" */,-21 , 24/* ")" */,-21 , 15/* ":" */,-21 , 13/* "}" */,-21 , 16/* "?:" */,-21 , 3/* "ELSE" */,-21 , 18/* "," */,-21 ),
	/* State 36 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 16/* "?:" */,-16 , 43/* "$" */,-16 , 2/* "IF" */,-16 , 5/* "DO" */,-16 , 4/* "WHILE" */,-16 , 6/* "FOR" */,-16 , 8/* "ECHO" */,-16 , 9/* "PRINT" */,-16 , 12/* "{" */,-16 , 17/* ";" */,-16 , 14/* "?" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 13/* "}" */,-16 ),
	/* State 37 */ new Array( 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 27/* "Identifier" */,62 , 23/* "(" */,25 ),
	/* State 38 */ new Array( 43/* "$" */,-24 , 2/* "IF" */,-24 , 5/* "DO" */,-24 , 4/* "WHILE" */,-24 , 6/* "FOR" */,-24 , 8/* "ECHO" */,-24 , 9/* "PRINT" */,-24 , 12/* "{" */,-24 , 17/* ";" */,-24 , 14/* "?" */,-24 , 21/* "++" */,-24 , 27/* "Identifier" */,-24 , 22/* "--" */,-24 , 26/* "operator" */,-24 , 10/* "CODE" */,-24 , 11/* "FUNCTION" */,-24 , 29/* "Integer" */,-24 , 30/* "Float" */,-24 , 28/* "String" */,-24 , 23/* "(" */,-24 , 24/* ")" */,-24 , 15/* ":" */,-24 , 13/* "}" */,-24 , 16/* "?:" */,-24 , 3/* "ELSE" */,-24 , 18/* "," */,-24 ),
	/* State 39 */ new Array( 43/* "$" */,-22 , 2/* "IF" */,-22 , 5/* "DO" */,-22 , 4/* "WHILE" */,-22 , 6/* "FOR" */,-22 , 8/* "ECHO" */,-22 , 9/* "PRINT" */,-22 , 12/* "{" */,-22 , 17/* ";" */,-22 , 14/* "?" */,-22 , 21/* "++" */,-22 , 27/* "Identifier" */,-22 , 22/* "--" */,-22 , 26/* "operator" */,-22 , 10/* "CODE" */,-22 , 11/* "FUNCTION" */,-22 , 29/* "Integer" */,-22 , 30/* "Float" */,-22 , 28/* "String" */,-22 , 23/* "(" */,-22 , 24/* ")" */,-22 , 15/* ":" */,-22 , 13/* "}" */,-22 , 16/* "?:" */,-22 , 3/* "ELSE" */,-22 , 18/* "," */,-22 ),
	/* State 40 */ new Array( 43/* "$" */,-23 , 2/* "IF" */,-23 , 5/* "DO" */,-23 , 4/* "WHILE" */,-23 , 6/* "FOR" */,-23 , 8/* "ECHO" */,-23 , 9/* "PRINT" */,-23 , 12/* "{" */,-23 , 17/* ";" */,-23 , 14/* "?" */,-23 , 21/* "++" */,-23 , 27/* "Identifier" */,-23 , 22/* "--" */,-23 , 26/* "operator" */,-23 , 10/* "CODE" */,-23 , 11/* "FUNCTION" */,-23 , 29/* "Integer" */,-23 , 30/* "Float" */,-23 , 28/* "String" */,-23 , 23/* "(" */,-23 , 24/* ")" */,-23 , 15/* ":" */,-23 , 13/* "}" */,-23 , 16/* "?:" */,-23 , 3/* "ELSE" */,-23 , 18/* "," */,-23 ),
	/* State 41 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 43/* "$" */,-25 , 2/* "IF" */,-25 , 5/* "DO" */,-25 , 4/* "WHILE" */,-25 , 6/* "FOR" */,-25 , 8/* "ECHO" */,-25 , 9/* "PRINT" */,-25 , 12/* "{" */,-25 , 17/* ";" */,-25 , 21/* "++" */,-25 , 27/* "Identifier" */,-25 , 22/* "--" */,-25 , 10/* "CODE" */,-25 , 11/* "FUNCTION" */,-25 , 29/* "Integer" */,-25 , 30/* "Float" */,-25 , 28/* "String" */,-25 , 23/* "(" */,-25 , 24/* ")" */,-25 , 15/* ":" */,-25 , 13/* "}" */,-25 , 16/* "?:" */,-25 , 3/* "ELSE" */,-25 , 18/* "," */,-25 ),
	/* State 42 */ new Array( 24/* ")" */,63 ),
	/* State 43 */ new Array( 23/* "(" */,64 ),
	/* State 44 */ new Array( 24/* ")" */,-34 , 18/* "," */,-34 ),
	/* State 45 */ new Array( 23/* "(" */,66 ),
	/* State 46 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 24/* ")" */,67 ),
	/* State 47 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 24/* ")" */,68 ),
	/* State 48 */ new Array( 23/* "(" */,69 ),
	/* State 49 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 24/* ")" */,70 ),
	/* State 50 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 17/* ";" */,71 ),
	/* State 51 */ new Array( 20/* "=" */,36 , 23/* "(" */,37 , 22/* "--" */,38 , 21/* "++" */,39 , 7/* "IN" */,72 , 17/* ";" */,-45 , 14/* "?" */,-45 , 26/* "operator" */,-45 ),
	/* State 52 */ new Array( 43/* "$" */,-11 , 2/* "IF" */,-11 , 5/* "DO" */,-11 , 4/* "WHILE" */,-11 , 6/* "FOR" */,-11 , 8/* "ECHO" */,-11 , 9/* "PRINT" */,-11 , 12/* "{" */,-11 , 17/* ";" */,-11 , 14/* "?" */,-11 , 21/* "++" */,-11 , 27/* "Identifier" */,-11 , 22/* "--" */,-11 , 26/* "operator" */,-11 , 10/* "CODE" */,-11 , 11/* "FUNCTION" */,-11 , 29/* "Integer" */,-11 , 30/* "Float" */,-11 , 28/* "String" */,-11 , 23/* "(" */,-11 , 13/* "}" */,-11 , 24/* ")" */,-11 , 15/* ":" */,-11 , 16/* "?:" */,-11 , 3/* "ELSE" */,-11 , 18/* "," */,-11 ),
	/* State 53 */ new Array( 43/* "$" */,-12 , 2/* "IF" */,-12 , 5/* "DO" */,-12 , 4/* "WHILE" */,-12 , 6/* "FOR" */,-12 , 8/* "ECHO" */,-12 , 9/* "PRINT" */,-12 , 12/* "{" */,-12 , 17/* ";" */,-12 , 14/* "?" */,-12 , 21/* "++" */,-12 , 27/* "Identifier" */,-12 , 22/* "--" */,-12 , 26/* "operator" */,-12 , 10/* "CODE" */,-12 , 11/* "FUNCTION" */,-12 , 29/* "Integer" */,-12 , 30/* "Float" */,-12 , 28/* "String" */,-12 , 23/* "(" */,-12 , 13/* "}" */,-12 , 24/* ")" */,-12 , 15/* ":" */,-12 , 16/* "?:" */,-12 , 3/* "ELSE" */,-12 , 18/* "," */,-12 ),
	/* State 54 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 43/* "$" */,-27 , 2/* "IF" */,-27 , 5/* "DO" */,-27 , 4/* "WHILE" */,-27 , 6/* "FOR" */,-27 , 8/* "ECHO" */,-27 , 9/* "PRINT" */,-27 , 12/* "{" */,-27 , 17/* ";" */,-27 , 21/* "++" */,-27 , 27/* "Identifier" */,-27 , 22/* "--" */,-27 , 10/* "CODE" */,-27 , 11/* "FUNCTION" */,-27 , 29/* "Integer" */,-27 , 30/* "Float" */,-27 , 28/* "String" */,-27 , 23/* "(" */,-27 , 13/* "}" */,-27 , 24/* ")" */,-27 , 15/* ":" */,-27 , 16/* "?:" */,-27 , 3/* "ELSE" */,-27 , 18/* "," */,-27 ),
	/* State 55 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 15/* ":" */,73 ),
	/* State 56 */ new Array( 13/* "}" */,-3 , 2/* "IF" */,-3 , 5/* "DO" */,-3 , 4/* "WHILE" */,-3 , 6/* "FOR" */,-3 , 8/* "ECHO" */,-3 , 9/* "PRINT" */,-3 , 12/* "{" */,-3 , 17/* ";" */,-3 , 14/* "?" */,-3 , 21/* "++" */,-3 , 27/* "Identifier" */,-3 , 22/* "--" */,-3 , 26/* "operator" */,-3 , 10/* "CODE" */,-3 , 11/* "FUNCTION" */,-3 , 29/* "Integer" */,-3 , 30/* "Float" */,-3 , 28/* "String" */,-3 , 23/* "(" */,-3 ),
	/* State 57 */ new Array( 43/* "$" */,-14 , 2/* "IF" */,-14 , 5/* "DO" */,-14 , 4/* "WHILE" */,-14 , 6/* "FOR" */,-14 , 8/* "ECHO" */,-14 , 9/* "PRINT" */,-14 , 12/* "{" */,-14 , 17/* ";" */,-14 , 14/* "?" */,-14 , 21/* "++" */,-14 , 27/* "Identifier" */,-14 , 22/* "--" */,-14 , 26/* "operator" */,-14 , 10/* "CODE" */,-14 , 11/* "FUNCTION" */,-14 , 29/* "Integer" */,-14 , 30/* "Float" */,-14 , 28/* "String" */,-14 , 23/* "(" */,-14 , 13/* "}" */,-14 , 24/* ")" */,-14 , 15/* ":" */,-14 , 16/* "?:" */,-14 , 3/* "ELSE" */,-14 , 18/* "," */,-14 ),
	/* State 58 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 16/* "?:" */,74 , 43/* "$" */,-40 , 2/* "IF" */,-40 , 5/* "DO" */,-40 , 4/* "WHILE" */,-40 , 6/* "FOR" */,-40 , 8/* "ECHO" */,-40 , 9/* "PRINT" */,-40 , 12/* "{" */,-40 , 17/* ";" */,-40 , 21/* "++" */,-40 , 27/* "Identifier" */,-40 , 22/* "--" */,-40 , 10/* "CODE" */,-40 , 11/* "FUNCTION" */,-40 , 29/* "Integer" */,-40 , 30/* "Float" */,-40 , 28/* "String" */,-40 , 23/* "(" */,-40 , 24/* ")" */,-40 , 15/* ":" */,-40 , 13/* "}" */,-40 , 3/* "ELSE" */,-40 , 18/* "," */,-40 ),
	/* State 59 */ new Array( 24/* ")" */,75 ),
	/* State 60 */ new Array( 18/* "," */,76 ),
	/* State 61 */ new Array( 24/* ")" */,-39 ),
	/* State 62 */ new Array( 24/* ")" */,-45 ),
	/* State 63 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 13/* "}" */,-16 , 16/* "?:" */,-16 ),
	/* State 64 */ new Array( 24/* ")" */,78 ),
	/* State 65 */ new Array( 18/* "," */,79 , 24/* ")" */,80 ),
	/* State 66 */ new Array( 24/* ")" */,-34 , 18/* "," */,-34 ),
	/* State 67 */ new Array( 43/* "$" */,-46 , 2/* "IF" */,-46 , 5/* "DO" */,-46 , 4/* "WHILE" */,-46 , 6/* "FOR" */,-46 , 8/* "ECHO" */,-46 , 9/* "PRINT" */,-46 , 12/* "{" */,-46 , 17/* ";" */,-46 , 14/* "?" */,-46 , 21/* "++" */,-46 , 27/* "Identifier" */,-46 , 22/* "--" */,-46 , 26/* "operator" */,-46 , 10/* "CODE" */,-46 , 11/* "FUNCTION" */,-46 , 29/* "Integer" */,-46 , 30/* "Float" */,-46 , 28/* "String" */,-46 , 23/* "(" */,-46 , 24/* ")" */,-46 , 15/* ":" */,-46 , 13/* "}" */,-46 , 16/* "?:" */,-46 , 3/* "ELSE" */,-46 , 18/* "," */,-46 ),
	/* State 68 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 3/* "ELSE" */,-16 , 43/* "$" */,-16 , 14/* "?" */,-16 , 13/* "}" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 16/* "?:" */,-16 ),
	/* State 69 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 24/* ")" */,-16 , 14/* "?" */,-16 ),
	/* State 70 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 13/* "}" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 ),
	/* State 71 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 17/* ";" */,-16 , 14/* "?" */,-16 ),
	/* State 72 */ new Array( 27/* "Identifier" */,86 ),
	/* State 73 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 2/* "IF" */,-16 , 5/* "DO" */,-16 , 4/* "WHILE" */,-16 , 6/* "FOR" */,-16 , 8/* "ECHO" */,-16 , 9/* "PRINT" */,-16 , 12/* "{" */,-16 , 17/* ";" */,-16 , 14/* "?" */,-16 , 13/* "}" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 ),
	/* State 74 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 2/* "IF" */,-16 , 5/* "DO" */,-16 , 4/* "WHILE" */,-16 , 6/* "FOR" */,-16 , 8/* "ECHO" */,-16 , 9/* "PRINT" */,-16 , 12/* "{" */,-16 , 17/* ";" */,-16 , 14/* "?" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 13/* "}" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 ),
	/* State 75 */ new Array( 43/* "$" */,-37 , 2/* "IF" */,-37 , 5/* "DO" */,-37 , 4/* "WHILE" */,-37 , 6/* "FOR" */,-37 , 8/* "ECHO" */,-37 , 9/* "PRINT" */,-37 , 12/* "{" */,-37 , 17/* ";" */,-37 , 14/* "?" */,-37 , 21/* "++" */,-37 , 27/* "Identifier" */,-37 , 22/* "--" */,-37 , 26/* "operator" */,-37 , 10/* "CODE" */,-37 , 11/* "FUNCTION" */,-37 , 29/* "Integer" */,-37 , 30/* "Float" */,-37 , 28/* "String" */,-37 , 23/* "(" */,-37 , 24/* ")" */,-37 , 15/* ":" */,-37 , 13/* "}" */,-37 , 16/* "?:" */,-37 , 3/* "ELSE" */,-37 , 18/* "," */,-37 ),
	/* State 76 */ new Array( 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 27/* "Identifier" */,62 , 23/* "(" */,25 ),
	/* State 77 */ new Array( 43/* "$" */,-31 , 2/* "IF" */,-31 , 5/* "DO" */,-31 , 4/* "WHILE" */,-31 , 6/* "FOR" */,-31 , 8/* "ECHO" */,-31 , 9/* "PRINT" */,-31 , 12/* "{" */,-31 , 17/* ";" */,-31 , 14/* "?" */,-31 , 21/* "++" */,-31 , 27/* "Identifier" */,-31 , 22/* "--" */,-31 , 26/* "operator" */,-31 , 10/* "CODE" */,-31 , 11/* "FUNCTION" */,-31 , 29/* "Integer" */,-31 , 30/* "Float" */,-31 , 28/* "String" */,-31 , 23/* "(" */,-31 , 24/* ")" */,-31 , 15/* ":" */,-31 , 13/* "}" */,-31 , 16/* "?:" */,-31 , 3/* "ELSE" */,-31 , 18/* "," */,-31 ),
	/* State 78 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 13/* "}" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 ),
	/* State 79 */ new Array( 27/* "Identifier" */,93 ),
	/* State 80 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 13/* "}" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 ),
	/* State 81 */ new Array( 18/* "," */,79 , 24/* ")" */,95 ),
	/* State 82 */ new Array( 3/* "ELSE" */,96 , 43/* "$" */,-5 , 2/* "IF" */,-5 , 5/* "DO" */,-5 , 4/* "WHILE" */,-5 , 6/* "FOR" */,-5 , 8/* "ECHO" */,-5 , 9/* "PRINT" */,-5 , 12/* "{" */,-5 , 17/* ";" */,-5 , 14/* "?" */,-5 , 21/* "++" */,-5 , 27/* "Identifier" */,-5 , 22/* "--" */,-5 , 26/* "operator" */,-5 , 10/* "CODE" */,-5 , 11/* "FUNCTION" */,-5 , 29/* "Integer" */,-5 , 30/* "Float" */,-5 , 28/* "String" */,-5 , 23/* "(" */,-5 , 13/* "}" */,-5 , 24/* ")" */,-5 , 15/* ":" */,-5 , 16/* "?:" */,-5 , 18/* "," */,-5 ),
	/* State 83 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 24/* ")" */,97 ),
	/* State 84 */ new Array( 43/* "$" */,-8 , 2/* "IF" */,-8 , 5/* "DO" */,-8 , 4/* "WHILE" */,-8 , 6/* "FOR" */,-8 , 8/* "ECHO" */,-8 , 9/* "PRINT" */,-8 , 12/* "{" */,-8 , 17/* ";" */,-8 , 14/* "?" */,-8 , 21/* "++" */,-8 , 27/* "Identifier" */,-8 , 22/* "--" */,-8 , 26/* "operator" */,-8 , 10/* "CODE" */,-8 , 11/* "FUNCTION" */,-8 , 29/* "Integer" */,-8 , 30/* "Float" */,-8 , 28/* "String" */,-8 , 23/* "(" */,-8 , 13/* "}" */,-8 , 24/* ")" */,-8 , 15/* ":" */,-8 , 16/* "?:" */,-8 , 3/* "ELSE" */,-8 , 18/* "," */,-8 ),
	/* State 85 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 17/* ";" */,98 ),
	/* State 86 */ new Array( 24/* ")" */,99 ),
	/* State 87 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 43/* "$" */,-17 , 2/* "IF" */,-17 , 5/* "DO" */,-17 , 4/* "WHILE" */,-17 , 6/* "FOR" */,-17 , 8/* "ECHO" */,-17 , 9/* "PRINT" */,-17 , 12/* "{" */,-17 , 17/* ";" */,-17 , 21/* "++" */,-17 , 27/* "Identifier" */,-17 , 22/* "--" */,-17 , 10/* "CODE" */,-17 , 11/* "FUNCTION" */,-17 , 29/* "Integer" */,-17 , 30/* "Float" */,-17 , 28/* "String" */,-17 , 23/* "(" */,-17 , 13/* "}" */,-17 , 24/* ")" */,-17 , 15/* ":" */,-17 , 16/* "?:" */,-17 , 3/* "ELSE" */,-17 , 18/* "," */,-17 ),
	/* State 88 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 43/* "$" */,-41 , 2/* "IF" */,-41 , 5/* "DO" */,-41 , 4/* "WHILE" */,-41 , 6/* "FOR" */,-41 , 8/* "ECHO" */,-41 , 9/* "PRINT" */,-41 , 12/* "{" */,-41 , 17/* ";" */,-41 , 21/* "++" */,-41 , 27/* "Identifier" */,-41 , 22/* "--" */,-41 , 10/* "CODE" */,-41 , 11/* "FUNCTION" */,-41 , 29/* "Integer" */,-41 , 30/* "Float" */,-41 , 28/* "String" */,-41 , 23/* "(" */,-41 , 24/* ")" */,-41 , 15/* ":" */,-41 , 13/* "}" */,-41 , 16/* "?:" */,-41 , 3/* "ELSE" */,-41 , 18/* "," */,-41 ),
	/* State 89 */ new Array( 24/* ")" */,-38 ),
	/* State 90 */ new Array( 43/* "$" */,-29 , 2/* "IF" */,-29 , 5/* "DO" */,-29 , 4/* "WHILE" */,-29 , 6/* "FOR" */,-29 , 8/* "ECHO" */,-29 , 9/* "PRINT" */,-29 , 12/* "{" */,-29 , 17/* ";" */,-29 , 14/* "?" */,-29 , 21/* "++" */,-29 , 27/* "Identifier" */,-29 , 22/* "--" */,-29 , 26/* "operator" */,-29 , 10/* "CODE" */,-29 , 11/* "FUNCTION" */,-29 , 29/* "Integer" */,-29 , 30/* "Float" */,-29 , 28/* "String" */,-29 , 23/* "(" */,-29 , 24/* ")" */,-29 , 15/* ":" */,-29 , 13/* "}" */,-29 , 16/* "?:" */,-29 , 3/* "ELSE" */,-29 , 18/* "," */,-29 ),
	/* State 91 */ new Array( 24/* ")" */,-33 , 18/* "," */,-33 ),
	/* State 92 */ new Array( 24/* ")" */,-35 , 18/* "," */,-35 ),
	/* State 93 */ new Array( 20/* "=" */,36 , 24/* ")" */,-36 , 18/* "," */,-36 ),
	/* State 94 */ new Array( 43/* "$" */,-32 , 2/* "IF" */,-32 , 5/* "DO" */,-32 , 4/* "WHILE" */,-32 , 6/* "FOR" */,-32 , 8/* "ECHO" */,-32 , 9/* "PRINT" */,-32 , 12/* "{" */,-32 , 17/* ";" */,-32 , 14/* "?" */,-32 , 21/* "++" */,-32 , 27/* "Identifier" */,-32 , 22/* "--" */,-32 , 26/* "operator" */,-32 , 10/* "CODE" */,-32 , 11/* "FUNCTION" */,-32 , 29/* "Integer" */,-32 , 30/* "Float" */,-32 , 28/* "String" */,-32 , 23/* "(" */,-32 , 24/* ")" */,-32 , 15/* ":" */,-32 , 13/* "}" */,-32 , 16/* "?:" */,-32 , 3/* "ELSE" */,-32 , 18/* "," */,-32 ),
	/* State 95 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 13/* "}" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 , 18/* "," */,-16 ),
	/* State 96 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 13/* "}" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 , 18/* "," */,-16 ),
	/* State 97 */ new Array( 17/* ";" */,102 ),
	/* State 98 */ new Array( 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 24/* ")" */,-16 , 14/* "?" */,-16 ),
	/* State 99 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 13/* "}" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 , 18/* "," */,-16 ),
	/* State 100 */ new Array( 43/* "$" */,-30 , 2/* "IF" */,-30 , 5/* "DO" */,-30 , 4/* "WHILE" */,-30 , 6/* "FOR" */,-30 , 8/* "ECHO" */,-30 , 9/* "PRINT" */,-30 , 12/* "{" */,-30 , 17/* ";" */,-30 , 14/* "?" */,-30 , 21/* "++" */,-30 , 27/* "Identifier" */,-30 , 22/* "--" */,-30 , 26/* "operator" */,-30 , 10/* "CODE" */,-30 , 11/* "FUNCTION" */,-30 , 29/* "Integer" */,-30 , 30/* "Float" */,-30 , 28/* "String" */,-30 , 23/* "(" */,-30 , 24/* ")" */,-30 , 15/* ":" */,-30 , 13/* "}" */,-30 , 16/* "?:" */,-30 , 3/* "ELSE" */,-30 , 18/* "," */,-30 ),
	/* State 101 */ new Array( 43/* "$" */,-6 , 2/* "IF" */,-6 , 5/* "DO" */,-6 , 4/* "WHILE" */,-6 , 6/* "FOR" */,-6 , 8/* "ECHO" */,-6 , 9/* "PRINT" */,-6 , 12/* "{" */,-6 , 17/* ";" */,-6 , 14/* "?" */,-6 , 21/* "++" */,-6 , 27/* "Identifier" */,-6 , 22/* "--" */,-6 , 26/* "operator" */,-6 , 10/* "CODE" */,-6 , 11/* "FUNCTION" */,-6 , 29/* "Integer" */,-6 , 30/* "Float" */,-6 , 28/* "String" */,-6 , 23/* "(" */,-6 , 13/* "}" */,-6 , 24/* ")" */,-6 , 15/* ":" */,-6 , 16/* "?:" */,-6 , 3/* "ELSE" */,-6 , 18/* "," */,-6 ),
	/* State 102 */ new Array( 43/* "$" */,-7 , 2/* "IF" */,-7 , 5/* "DO" */,-7 , 4/* "WHILE" */,-7 , 6/* "FOR" */,-7 , 8/* "ECHO" */,-7 , 9/* "PRINT" */,-7 , 12/* "{" */,-7 , 17/* ";" */,-7 , 14/* "?" */,-7 , 21/* "++" */,-7 , 27/* "Identifier" */,-7 , 22/* "--" */,-7 , 26/* "operator" */,-7 , 10/* "CODE" */,-7 , 11/* "FUNCTION" */,-7 , 29/* "Integer" */,-7 , 30/* "Float" */,-7 , 28/* "String" */,-7 , 23/* "(" */,-7 , 13/* "}" */,-7 , 24/* ")" */,-7 , 15/* ":" */,-7 , 16/* "?:" */,-7 , 3/* "ELSE" */,-7 , 18/* "," */,-7 ),
	/* State 103 */ new Array( 26/* "operator" */,32 , 14/* "?" */,33 , 24/* ")" */,105 ),
	/* State 104 */ new Array( 43/* "$" */,-10 , 2/* "IF" */,-10 , 5/* "DO" */,-10 , 4/* "WHILE" */,-10 , 6/* "FOR" */,-10 , 8/* "ECHO" */,-10 , 9/* "PRINT" */,-10 , 12/* "{" */,-10 , 17/* ";" */,-10 , 14/* "?" */,-10 , 21/* "++" */,-10 , 27/* "Identifier" */,-10 , 22/* "--" */,-10 , 26/* "operator" */,-10 , 10/* "CODE" */,-10 , 11/* "FUNCTION" */,-10 , 29/* "Integer" */,-10 , 30/* "Float" */,-10 , 28/* "String" */,-10 , 23/* "(" */,-10 , 13/* "}" */,-10 , 24/* ")" */,-10 , 15/* ":" */,-10 , 16/* "?:" */,-10 , 3/* "ELSE" */,-10 , 18/* "," */,-10 ),
	/* State 105 */ new Array( 2/* "IF" */,3 , 5/* "DO" */,4 , 4/* "WHILE" */,5 , 6/* "FOR" */,6 , 8/* "ECHO" */,7 , 9/* "PRINT" */,8 , 12/* "{" */,10 , 17/* ";" */,11 , 21/* "++" */,15 , 27/* "Identifier" */,16 , 22/* "--" */,17 , 26/* "operator" */,18 , 10/* "CODE" */,20 , 11/* "FUNCTION" */,21 , 29/* "Integer" */,22 , 30/* "Float" */,23 , 28/* "String" */,24 , 23/* "(" */,25 , 43/* "$" */,-16 , 14/* "?" */,-16 , 13/* "}" */,-16 , 24/* ")" */,-16 , 15/* ":" */,-16 , 16/* "?:" */,-16 , 3/* "ELSE" */,-16 , 18/* "," */,-16 ),
	/* State 106 */ new Array( 43/* "$" */,-9 , 2/* "IF" */,-9 , 5/* "DO" */,-9 , 4/* "WHILE" */,-9 , 6/* "FOR" */,-9 , 8/* "ECHO" */,-9 , 9/* "PRINT" */,-9 , 12/* "{" */,-9 , 17/* ";" */,-9 , 14/* "?" */,-9 , 21/* "++" */,-9 , 27/* "Identifier" */,-9 , 22/* "--" */,-9 , 26/* "operator" */,-9 , 10/* "CODE" */,-9 , 11/* "FUNCTION" */,-9 , 29/* "Integer" */,-9 , 30/* "Float" */,-9 , 28/* "String" */,-9 , 23/* "(" */,-9 , 13/* "}" */,-9 , 24/* ")" */,-9 , 15/* ":" */,-9 , 16/* "?:" */,-9 , 3/* "ELSE" */,-9 , 18/* "," */,-9 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 31/* Program */,1 ),
	/* State 1 */ new Array( 32/* Stmt */,2 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 2 */ new Array(  ),
	/* State 3 */ new Array(  ),
	/* State 4 */ new Array( 32/* Stmt */,27 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 5 */ new Array(  ),
	/* State 6 */ new Array(  ),
	/* State 7 */ new Array( 34/* Expression */,30 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 8 */ new Array( 34/* Expression */,31 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 9 */ new Array(  ),
	/* State 10 */ new Array( 33/* Stmt_List */,34 ),
	/* State 11 */ new Array(  ),
	/* State 12 */ new Array(  ),
	/* State 13 */ new Array(  ),
	/* State 14 */ new Array(  ),
	/* State 15 */ new Array(  ),
	/* State 16 */ new Array(  ),
	/* State 17 */ new Array(  ),
	/* State 18 */ new Array( 34/* Expression */,41 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 19 */ new Array(  ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array(  ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array(  ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array( 34/* Expression */,46 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 26 */ new Array( 34/* Expression */,47 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 27 */ new Array(  ),
	/* State 28 */ new Array( 34/* Expression */,49 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 29 */ new Array( 34/* Expression */,50 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 30 */ new Array(  ),
	/* State 31 */ new Array(  ),
	/* State 32 */ new Array( 34/* Expression */,54 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 33 */ new Array( 34/* Expression */,55 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 34 */ new Array( 32/* Stmt */,56 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 35 */ new Array(  ),
	/* State 36 */ new Array( 34/* Expression */,58 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 37 */ new Array( 41/* LValue */,59 , 42/* Lvalue */,60 , 38/* Value */,61 ),
	/* State 38 */ new Array(  ),
	/* State 39 */ new Array(  ),
	/* State 40 */ new Array(  ),
	/* State 41 */ new Array(  ),
	/* State 42 */ new Array(  ),
	/* State 43 */ new Array(  ),
	/* State 44 */ new Array( 39/* LARGS */,65 ),
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
	/* State 56 */ new Array(  ),
	/* State 57 */ new Array(  ),
	/* State 58 */ new Array(  ),
	/* State 59 */ new Array(  ),
	/* State 60 */ new Array(  ),
	/* State 61 */ new Array(  ),
	/* State 62 */ new Array(  ),
	/* State 63 */ new Array( 32/* Stmt */,77 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 64 */ new Array(  ),
	/* State 65 */ new Array(  ),
	/* State 66 */ new Array( 39/* LARGS */,81 ),
	/* State 67 */ new Array(  ),
	/* State 68 */ new Array( 32/* Stmt */,82 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 69 */ new Array( 34/* Expression */,83 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 70 */ new Array( 32/* Stmt */,84 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 71 */ new Array( 34/* Expression */,85 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 72 */ new Array(  ),
	/* State 73 */ new Array( 34/* Expression */,87 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 74 */ new Array( 34/* Expression */,88 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 75 */ new Array(  ),
	/* State 76 */ new Array( 38/* Value */,89 ),
	/* State 77 */ new Array(  ),
	/* State 78 */ new Array( 32/* Stmt */,90 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 79 */ new Array( 40/* ARGS */,91 , 37/* Assign */,92 ),
	/* State 80 */ new Array( 32/* Stmt */,94 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 81 */ new Array(  ),
	/* State 82 */ new Array(  ),
	/* State 83 */ new Array(  ),
	/* State 84 */ new Array(  ),
	/* State 85 */ new Array(  ),
	/* State 86 */ new Array(  ),
	/* State 87 */ new Array(  ),
	/* State 88 */ new Array(  ),
	/* State 89 */ new Array(  ),
	/* State 90 */ new Array(  ),
	/* State 91 */ new Array(  ),
	/* State 92 */ new Array(  ),
	/* State 93 */ new Array(  ),
	/* State 94 */ new Array(  ),
	/* State 95 */ new Array( 32/* Stmt */,100 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 96 */ new Array( 32/* Stmt */,101 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 97 */ new Array(  ),
	/* State 98 */ new Array( 34/* Expression */,103 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 99 */ new Array( 32/* Stmt */,104 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 100 */ new Array(  ),
	/* State 101 */ new Array(  ),
	/* State 102 */ new Array(  ),
	/* State 103 */ new Array(  ),
	/* State 104 */ new Array(  ),
	/* State 105 */ new Array( 32/* Stmt */,106 , 34/* Expression */,9 , 35/* Constructor */,12 , 36/* Callable */,13 , 37/* Assign */,14 , 38/* Value */,19 ),
	/* State 106 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"Program'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"IF" /* Terminal symbol */,
	"ELSE" /* Terminal symbol */,
	"WHILE" /* Terminal symbol */,
	"DO" /* Terminal symbol */,
	"FOR" /* Terminal symbol */,
	"IN" /* Terminal symbol */,
	"ECHO" /* Terminal symbol */,
	"PRINT" /* Terminal symbol */,
	"CODE" /* Terminal symbol */,
	"FUNCTION" /* Terminal symbol */,
	"{" /* Terminal symbol */,
	"}" /* Terminal symbol */,
	"?" /* Terminal symbol */,
	":" /* Terminal symbol */,
	"?:" /* Terminal symbol */,
	";" /* Terminal symbol */,
	"," /* Terminal symbol */,
	".." /* Terminal symbol */,
	"=" /* Terminal symbol */,
	"++" /* Terminal symbol */,
	"--" /* Terminal symbol */,
	"(" /* Terminal symbol */,
	")" /* Terminal symbol */,
	"#" /* Terminal symbol */,
	"operator" /* Terminal symbol */,
	"Identifier" /* Terminal symbol */,
	"String" /* Terminal symbol */,
	"Integer" /* Terminal symbol */,
	"Float" /* Terminal symbol */,
	"Program" /* Non-terminal symbol */,
	"Stmt" /* Non-terminal symbol */,
	"Stmt_List" /* Non-terminal symbol */,
	"Expression" /* Non-terminal symbol */,
	"Constructor" /* Non-terminal symbol */,
	"Callable" /* Non-terminal symbol */,
	"Assign" /* Non-terminal symbol */,
	"Value" /* Non-terminal symbol */,
	"LARGS" /* Non-terminal symbol */,
	"ARGS" /* Non-terminal symbol */,
	"LValue" /* Non-terminal symbol */,
	"Lvalue" /* Non-terminal symbol */,
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
		act = 108;
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
		if( act == 108 )
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
			
			while( act == 108 && la != 43 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery\n" +
									"Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
									"Action: " + act + "\n\n" );
				if( la == -1 )
					info.offset++;
					
				while( act == 108 && sstack.length > 0 )
				{
					sstack.pop();
					vstack.pop();
					
					if( sstack.length == 0 )
						break;
						
					act = 108;
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == la )
						{
							act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
				}
				
				if( act != 108 )
					break;
				
				for( var i = 0; i < rsstack.length; i++ )
				{
					sstack.push( rsstack[i] );
					vstack.push( rvstack[i] );
				}
				
				la = __NODEJS_lex( info );
			}
			
			if( act == 108 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery failed, terminating parse process..." );
				break;
			}


			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tError recovery succeeded, continuing" );
		}
		
		/*
		if( act == 108 )
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
		 execute( vstack[ vstack.length - 1 ] ); 
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
		 rval = createNode( NODE_OP, OP_IF, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 6:
	{
		 rval = createNode( NODE_OP, OP_IF_ELSE, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 7:
	{
		 rval = createNode( NODE_OP, OP_DO_WHILE, vstack[ vstack.length - 6 ], vstack[ vstack.length - 3 ] ); 
	}
	break;
	case 8:
	{
		 rval = createNode( NODE_OP, OP_WHILE_DO, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 9:
	{
		 rval = createNode( NODE_OP, OP_FOR, vstack[ vstack.length - 7 ], vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 10:
	{
		 rval = createNode( NODE_OP, OP_FORIN, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 11:
	{
		 rval = createNode( NODE_OP, OP_ECHO, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 12:
	{
		 rval = createNode( NODE_OP, OP_ECHO, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 13:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 14:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 15:
	{
		 rval = createNode( NODE_OP, OP_NONE ); 
	}
	break;
	case 16:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 17:
	{
		 rval = createNode( NODE_OP, OP_TAIRNAIRE, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 18:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 19:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 20:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 21:
	{
		 rval = createNode( NODE_OP, OP_INCR_POST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 22:
	{
		 rval = createNode( NODE_OP, OP_INCR_PRE, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 23:
	{
		 rval = createNode( NODE_OP, OP_DECR_POST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 24:
	{
		 rval = createNode( NODE_OP, OP_DECR_PRE, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 25:
	{
		 rval = createNode( NODE_OPERATOR, OPERATOR_POST, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 26:
	{
		 rval = createNode( NODE_OPERATOR, OPERATOR_PRE, vstack[ vstack.length - 1 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 27:
	{
		 rval = createNode( NODE_OPERATOR, OPERATOR_BOTH, vstack[ vstack.length - 2 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 28:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 29:
	{
		rval = vstack[ vstack.length - 5 ];
	}
	break;
	case 30:
	{
		rval = vstack[ vstack.length - 6 ];
	}
	break;
	case 31:
	{
		rval = vstack[ vstack.length - 4 ];
	}
	break;
	case 32:
	{
		rval = vstack[ vstack.length - 5 ];
	}
	break;
	case 33:
	{
		rval = vstack[ vstack.length - 3 ];
	}
	break;
	case 34:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 35:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 36:
	{
		 rval = vstack[ vstack.length - 1 ] 
	}
	break;
	case 37:
	{
		 rval = vstack[ vstack.length - 4 ] 
	}
	break;
	case 38:
	{
		rval = vstack[ vstack.length - 3 ];
	}
	break;
	case 39:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 40:
	{
		 rval = createNode( NODE_OP, OP_ASSIGN, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 41:
	{
		 rval = createNode( NODE_OP, OP_BINAIRE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 5 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 42:
	{
		 rval = createNode( NODE_CONST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 43:
	{
		 rval = createNode( NODE_FLOAT, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 44:
	{
		 rval = createNode( NODE_STRING, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 45:
	{
		 rval = createNode( NODE_VAR, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 46:
	{
		 rval = createNode( NODE_OP,OP_NONE, vstack[ vstack.length - 2 ] ); 
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



	exports.setVar = letvar;
	exports.getVar = getvar;
	exports.parseFileSync = function(file){
		var str = require("fs").readFileSync( file ).toString("utf-8");
		var error_cnt = 0;
		var error_off = new Array();
		var error_la = new Array();
		error_cnt = __NODEJS_parse(str, error_off, error_la);
		return [
			error_cnt,
			error_off,
			error_la
		];
	};
	exports.parseFile = function(file){
		var str = require("fs").readFileSync( file ).toString("utf-8");
		var error_cnt = 0;
		var error_off = new Array();
		var error_la = new Array();
		error_cnt = __NODEJS_parse(str, error_off, error_la);
		return [
			error_cnt,
			error_off,
			error_la
		];
	};
	exports.parse = function(str){
		str = str.toString("utf-8");
		var error_cnt = 0;
		var error_off = new Array();
		var error_la = new Array();
		error_cnt = __NODEJS_parse(str, error_off, error_la);
		return [
			error_cnt,
			error_off,
			error_la
		];
	};
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

