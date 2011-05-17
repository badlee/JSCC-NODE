
//////////////////////////////////////
// GLOBALLY USED VARS AND FUNCTIONS //
//////////////////////////////////////

// Defined via loader
var phypeTestSuite;
var phpScripts;
var phypeDoc;
var fromShell;

// Phype array. When an array is assigned into a JSON-object, it loses its properties and
// functions. We create our own JSON-based array object to prevent this.
var phypeArrayObject = {
	'length' : 0,
	'push' : function(elm) {
		this[this.length] = elm;
		this.length = this.length+1;
	},
	'pop' : function() {
		delete this[this.length-1];
		this.length = this.length-1;
	}
};

function newPhypeArr() {
	return clone(phypeArrayObject);
};

// Constants used for keeping track of states and variables.
var cons = {
	global : '.global',
	objGlobal : '.objGlobal',
	val : '.val#',
	arr : '.arr#',
	obj : '.obj#',
	unset : '.uns#'
};

// State object.
var pstate = {
	// ACTUAL VALUES AND OBJECTS
	symTables : {
		'.global' : {}
	},
	valTable : {},
	arrTable : {},
	objMapping : {},
	
	/**
	 * Table for keeping actual objects
	 */
	objList : newPhypeArr(),
	
	
	// FORMAL DECLARATIONS
	/**
	 * Function table
	 */
	funTable : {},
	
	/**
	 * Class table
	 */
	classTable : {},
	
	
	// TEMPORARY STATE TRACKING VARIABLES
	/**
	 * Variable for keeping track of currently executing function.
	 */
	curFun : cons.global,
	curClass : '',
	curObj : -1,
	
	/**
	 * Variable for keeping track of formal parameters for a function declaration.
	 */
	curParams : newPhypeArr(),
	
	/**
	 * Variable for keeping track of currently passed actual parameters of a function invocation.
	 */
	passedParams : 0,
	
	/**
	 * These variables keeps track of current members of the class being defined.
	 */
	curAttrs : [],
	curFuns : [],
	
	/**
	 * Variable telling whether a termination event has been received (i.e. a return).
	 */
	term : false,
	
	/**
	 * Variable for keeping track of most recent return value.
	 */
	'return' : '',
	
	
	// TEST SUITE VARIABLES
	/**
	 * Keeps track of assertions.
	 */
	assertion : null
};

var origState = clone(pstate);

function resetState() {
	pstate = clone(origState);
};


///////////////////
// STATE OBJECTS //
///////////////////
function NODE() {
	var type;
	var value;
	var children;
}

function FUNC() {
	var name;
	var params;
	var nodes;
}

function VAL() {
	var type;
	var value;
}

function MEMBER() {
	var mod;
	var member;
	var init;
}

function CLASS() {
	var mod;
	var name;
	var attrs;
	var funs;
}

function OBJECT() {
	var objListEntry;
	var references;
	var classDef;
}

function ASSERTION() {
	var type;
	var value;
}

/**
 * Function for creating node objects.
 */
function createNode( type, value, children ) {
	var n = new NODE();
	n.type = type;
	n.value = value;	
	n.children = new Array();
	
	for( var i = 2; i < arguments.length; i++ )
		n.children.push( arguments[i] );
		
	return n;
}

/**
 * Function for creating functions.
 */
function createFunction( name, params, nodes ) {
	var f = new FUNC();
	f.name = name;
	f.params = params;
	f.nodes = new Array();
	
	for( var i = 2; i < arguments.length; i++ )
		f.nodes.push( arguments[i] );
		
	return f;
}

/**
 * Function for creating values (constant types, arrays or objects).
 */
function createValue( type, value ) {
	var v = new VAL();
	v.type = type;
	v.value = value;
	
	return v;
}

/**
 * Creates member objects for the class model.
 */
function createMember( mod, member, init ) {
	var m = new MEMBER();
	m.mod = mod;
	m.member = member;
	if (init)
		m.init = init;
	
	return m;
}

/**
 * Creates a class model.
 */
function createClass( mod, name, attrs, funs ) {
	var c = new CLASS();
	c.mod = mod;
	c.name = name;
	c.attrs = attrs;
	c.funs = funs;
	
	return c;
}

/**
 * Creates an object.
 */
function createObject( objListEntry, classDefName ) {
	var obj = new OBJECT();
	obj.objListEntry = objListEntry;
	obj.references = 0;
	obj.classDef = classDefName;
	
	return obj;
}

/**
 * Create a deep clone of a value.
 * 
 * YES, it's expensive!! So is it in PHP.
 */
function clone( value ) {
	if(value == null || typeof(value) != 'object')
		return value;

	var tmp = {};
	for(var key in value)
		tmp[key] = clone(value[key]);

	return tmp;
}

/**
 * Create an assertion for testing against when we are in our test suite
 */
function createAssertion( type, value ) {
	var a = new ASSERTION();
	a.type = type;
	a.value = value;
	
	return a;
}


/////////////////
// VAR LINKING //
/////////////////
/**
 * For linking variable references to values, preserving scopes.
 */
var linker = {
	assignVar : function(varName, val, scope) {
		if (!scope)
			scope = pstate.curFun;

		if (typeof(pstate.symTables[scope]) != 'object')
			pstate.symTables[scope] = {};

		var refTable = linker.getRefTableByVal(val);
		var prefix = linker.getConsDefByVal(val);
		
		pstate.symTables[scope][varName] = prefix+scope+'#'+varName;

		// If we are assigning an object, make a reference to the assigned object,
		// and increment the object's reference count.
		if (val.type == T_OBJECT) {
			var entry = val.value.objListEntry;
			pstate.objList[entry].value.references++;
			refTable[scope+'#'+varName] = entry;
		} else
			refTable[scope+'#'+varName] = val;
	},
	
	assignArr : function(varName, key, val, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope]) != 'object')
			pstate.symTables[scope] = {};
		
		// Initialize the variable as an array
		linker.unlinkVar(varName,scope);
		pstate.symTables[scope][varName] = cons.arr+scope+'#'+varName;
		
		// Check that the entry exists. Initialize it if it does not.
		var arrTableKey = scope+'#'+varName;
		if (!pstate.arrTable[arrTableKey]) {
			var valArr = {};
			valArr[key.value] = val;
			pstate.arrTable[arrTableKey] = createValue( T_ARRAY, valArr );
		}
		// Else insert the array key into the existing entry
		else {
			pstate.arrTable[arrTableKey]["value"][key.value] = val;
		}
	},
	
	assignArrMulti : function(varName, keys, val, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope]) != 'object')
			pstate.symTables[scope] = {};
		
		// Initialize the variable as an array
		linker.unlinkVar(varName,scope);
		pstate.symTables[scope][varName] = cons.arr+scope+'#'+varName;
		
		// Check that the entry exists. Initialize it if it does not.
		var arrTableKey = scope+'#'+varName;
		if (!pstate.arrTable[arrTableKey])
			pstate.arrTable[arrTableKey] = createValue( T_ARRAY, {} );

		var keyRef = 'pstate.arrTable[arrTableKey]["value"]';
		for ( var i=0; i<keys.length; i++ ) {
			eval('if (!'+keyRef+'["'+keys[i].value+'"]) '+keyRef+'["'+keys[i].value+'"] = createValue( T_ARRAY, {} );');
			keyRef = keyRef+'["'+keys[i].value+'"]["value"]';
		}

		keyRef = keyRef+' = val;';
		eval(keyRef);
	},

	getValue : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		// Look up the potentially recursively defined variable.
		varName = linker.linkRecursively(varName);
		
		if (varName == 'this') {
			return pstate.objList[pstate.curObj];
		}
		
		var refTable = linker.getRefTableByVar(varName);
		
		if (typeof(pstate.symTables[scope])=='object' && typeof(pstate.symTables[scope][varName])=='string') {
			var lookupStr = pstate.symTables[scope][varName];
			lookupStr = lookupStr.substr(5,lookupStr.length);
			
			var ret = null;
			if (refTable == pstate.objMapping)
				ret = pstate.objList[refTable[lookupStr]];
			else
				ret = clone(refTable[lookupStr]);
			return ret;
		} else if (typeof(pstate.symTables[cons.global])=='string') {
			var lookupStr = pstate.symTables[cons.global][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);
			
			var ret = null;
			if (refTable == pstate.objMapping)
				ret = pstate.objList[refTable[lookupStr]];
			else
				ret = clone(refTable[lookupStr]);
			return ret;
		}

		//throw varNotFound(varName);
	},
	
	getValueFromObj : function(targetObj, varName, scope) {
		// Look up the potentially recursively defined variable.
		varName = linker.linkRecursively(varName);
		varName = targetObj+'::'+varName;
		
		return linker.getValue(varName);
	},
	
	getArrValue : function(varName, key, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		var cleanVarName = varName.match(/[^\$]*/);

		var result = '';
		if (typeof(pstate.symTables[scope])=='object' && typeof(pstate.symTables[scope][cleanVarName])=='string') {
			var prefix = pstate.symTables[scope][cleanVarName].substring(0,5);
			// THIS IS NOT COMPLIANT WITH STANDARD PHP!
			// PHP will lookup the character at the position defined by the array key.
			if (prefix != cons.arr) {
				throw expectedArrNotFound(cleanVarName);
			}
			
			var lookupStr = pstate.symTables[scope][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);

			// Look up the value of the variable
			if (pstate.arrTable[lookupStr] && pstate.arrTable[lookupStr]["value"][key.value]) {
				result = pstate.arrTable[lookupStr]["value"][key.value];
			}
		} else if (typeof(pstate.symTables[cons.global][cleanVarName])=='string') {
			var lookupStr = pstate.symTables[cons.global][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);
			
			// Look up the value of the variable
			if (pstate.arrTable[lookupStr] && pstate.arrTable[lookupStr]["value"][key.value])
				result = pstate.arrTable[lookupStr]["value"][key.value];
		} else {
			throw varNotFound(varName);
		}

		// Look up the potentially recursively defined variable.
		if (varName != cleanVarName) {
			return linker.getValue(result);
		} else {
			return clone(result);
		}
	},
	
	getArrValueMulti : function(varName, keys, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		var cleanVarName = varName.match(/[^\$]*/);
		
		var result = '';
		if (typeof(pstate.symTables[scope])=='object' && typeof(pstate.symTables[scope][cleanVarName])=='string') {
			var prefix = pstate.symTables[scope][cleanVarName].substring(0,5);
			// THIS IS NOT COMPLIANT WITH STANDARD PHP!
			// PHP will lookup the character at the position defined by the array key.
			if (prefix != cons.arr) {
				throw expectedArrNotFound(cleanVarName);
			}
			
			var lookupStr = pstate.symTables[scope][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);

			// Generate key lookup-command
			var keyRef = 'pstate.arrTable[lookupStr]["value"]';
			for ( var i=0; i<keys.length; i++ ) {
				keyRef = keyRef+'["'+keys[i].value+'"]["value"]';
			}

			// Look up the value of the variable
			keyRef = 'result = '+keyRef+';';
			eval(keyRef);
		} else if (typeof(pstate.symTables[cons.global][cleanVarName])=='string') {
			var lookupStr = pstate.symTables[cons.global][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);
			
			// Generate key lookup-command
			var keyRef = 'pstate.arrTable[lookupStr]["value"]';
			for ( var i=0; i<keys.length; i++ ) {
				keyRef = keyRef+'["'+keys[i].value+'"]["value"]';
			}
			
			// Look up the value of the variable
			keyRef = 'result = '+keyRef+';';
			eval(keyRef);
		} else {
			throw varNotFound(varName);
		}
		
		// Look up the potentially recursively defined variable.
		if (varName != cleanVarName) {
			return linker.getValue(result);
		} else {
			return clone(result);
		}
	},
	
	/*
	 * For linking variable references (unsupported as of yet).
	linkVar : function(locVarName, varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(symTables[scope])!='object')
			pstate.symTables[scope] = {};
		
		pstate.symTables[scope][locVarName] = varName;
		if (typeof(pstate.valTable[scope+'#'+varName])!='string')
			pstate.valTable[scope+'#'+varName] = '';
	},
	*/
	
	unlinkVar : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		var prefix = linker.getConsDefByVar(varName);
		if (prefix == cons.unset)
			return;
		
		delete pstate.valTable[pstate.symTables[scope][varName]];
		delete pstate.symTables[prefix+scope+'#'+varName];
	},
	
	getRefTableByVal : function(value) {
		// Check for sym type
		switch (value.type) {
			case T_INT:
			case T_FLOAT:
			case T_CONST:
				return pstate.valTable;
			case T_ARRAY:
				return pstate.arrTable;
			case T_OBJECT:
				return pstate.objMapping;
			default:
				return null;
		}
	},
	
	getRefTableByConsDef : function(consDef) {
		switch (consDef) {
			case cons.val:
				return pstate.valTable;
			case cons.arr:
				return pstate.arrTable;
			case cons.obj:
				return pstate.objMapping;
			default:
				return null;
		}
	},
	
	getRefTableByVar : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope])!='object')
			pstate.symTables[scope] = {};
		
		// Get symbol name
		var symName = '';
		if (typeof(pstate.symTables[scope][varName])=='string')
			symName = pstate.symTables[scope][varName];
		else if (typeof(pstate.symTables[cons.global][varName])=='string')
			symName = pstate.symTables[cons.global][varName];
		else
			symName = cons.unset;
			
			
		// Check for sym type
		switch (symName.substring(0,5)) {
			case cons.val:
				return pstate.valTable;
			case cons.arr:
				return pstate.arrTable;
			case cons.obj:
				return pstate.objMapping;
			default:
				return null;
		}
	},
	
	linkRecursively : function(varName) {
		if (typeof(varName) != 'string' && varName.type != T_CONST)
			return varName;
		else if (typeof(varName) == 'string') {
			varNameVal = varName;
		} else varNameVal = varName.value;
		
		var firstChar = varNameVal.substring(0,1);
		if (firstChar == "$") {
			varName = linker.getValue( varNameVal.substring( 1,varNameVal.length ) ).value;
		}
		
		return varName;
	},
	
	getConsDefByVal : function(val) {
		var intType = val.type;
		switch (intType) {
			case T_INT:
			case T_FLOAT:
			case T_CONST:
				return cons.val;
			case T_ARRAY:
				return cons.arr;
			case T_OBJECT:
				return cons.obj;
			default:
				return null;
		}
	},
	
	getConsDefByVar : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope])!='object')
			pstate.symTables[scope] = {};
		
		// Get symbol name
		var symName = '';
		if (typeof(pstate.symTables[scope][varName])=='string')
			symName = pstate.symTables[scope][varName];
		else if (typeof(pstate.symTables[cons.global][varName])=='string')
			symName = pstate.symTables[cons.global][varName];
		else
			symName = '.unset';
		
		return symName.substring(0,5);
	},
	
	getNumberFromNode : function(node) {
		var num = null;
		switch (node.type) {
			// TODO: Check for PHP-standard.
			case T_INT:
			case T_CONST:
				num = parseInt(node.value);
				break;
			case T_FLOAT:
				num = parseFloat(node.value);
				break;
		}

		return num;
	}
};


//////////////////////////
// CLASS/OBJECT LINKING //
//////////////////////////
var classLinker = {
	createObjectFromClass : function(classDef) {
		// Init object and add it to the list of objects.
		var objListLength = pstate.objList.length;
		var obj = createObject( objListLength, classDef.name );
		pstate.objList.push(createValue( T_OBJECT, obj ));
		
		// Init variable list
		for (var attr in classDef.attrs) {
			var vName = classDef.attrs[attr].member;
			var vVal = execute( classDef.attrs[attr].init );
			if (!vVal || vVal == 'undefined')
				vVal = null;
			
			var lookupStr = objListLength+'::'+vName;
			pstate.symTables['.global'][objListLength+'::'+vName] = linker.getConsDefByVal(vVal)+lookupStr;
			
			var refTable = linker.getRefTableByVal(vVal);

			refTable[lookupStr] = vVal;
		}
		
		return obj;
	},
	
	decrementObjectRef : function(obj) {
		if (obj) {
			obj.references--;
			if (obj.references <= 0) {
				classLinker.deleteObject(obj);
			}
		}
	},
	
	deleteObject : function(obj) {
		var className = pstate.objList[obj.objListEntry];
		
		// Remove from object list
		delete pstate.objList[obj.objListEntry];
		
		classDef = pstate.classTable[obj.classDef];
		
		// Clear attributes
		for (var attr in classDef.attrs) {
			var vName = attr;
			var r = pstate.symTables['.global'][obj.objListEntry+'::'+vName];
			var refTable = linker.getRefTableByConsDef(r.substring(0,5));
			delete refTable[r.substring(5,r.length)];
			delete pstate.symTables['.global'][obj.objListEntry+'::'+vName];
		}
		
		delete obj;
	},
	
	checkVisibility : function(invokerClassName, targetClassName, targetMemberName) {
		// get MOD
		var mod = -1;
		var fun = pstate.classTable[targetClassName]['funs'][targetMemberName];

		if (fun)
			mod = fun.mod;
		else {
			attr = pstate.classTable[targetClassName]['attrs'][targetMemberName];
			if (!attr) return false;
			mod = attr.mod;
		}
	
		switch (mod) {
			case MOD_PUBLIC:
				return true;
			case MOD_PRIVATE:
				return (invokerClassName == targetClassName);
			case MOD_PROTECTED:
				if (invokerClassName == targetClassName)
					return true;
				else throw 'Inheritance not yet supported.';
		}
	}
};



/////////////////////////////
// OP AND TYPE DEFINITIONS //
/////////////////////////////

// Value types
var T_CONST			= 0;
var T_ARRAY			= 1;
var T_OBJECT		= 2;
var T_INT			= 3;
var T_FLOAT			= 4;

// Node types
var NODE_OP			= 0;
var NODE_VAR		= 1;
var NODE_CONST		= 2;
var NODE_INT		= 3;
var NODE_FLOAT		= 4;

// Op types
var OP_NONE			= 0;
var OP_ASSIGN		= 1;
var OP_IF			= 2;
var OP_IF_ELSE		= 3;
var OP_WHILE_DO		= 4;
var OP_DO_WHILE		= 5;
var OP_FCALL		= 6;
var OP_PASS_PARAM	= 7;
var OP_RETURN		= 8;
var OP_ECHO			= 9;
var OP_ASSIGN_ARR	= 10;
var OP_FETCH_ARR	= 11;
var OP_ARR_KEYS_R	= 12;
var OP_OBJ_NEW		= 13;
var OP_OBJ_FCALL	= 14;
var OP_OBJ_FETCH	= 15;
var OP_ATTR_ASSIGN	= 16;

var OP_EQU			= 30;
var OP_NEQ			= 31;
var OP_GRT			= 32;
var OP_LOT			= 33;
var OP_GRE			= 34;
var OP_LOE			= 35;
var OP_ADD			= 36;
var OP_SUB			= 37;
var OP_DIV			= 38;
var OP_MUL			= 39;
var OP_NEG			= 40;
var OP_CONCAT		= 41;
var OP_BOOL_NEG		= 42;

var OP_FOR			= 50;
var OP_FOREACH		= 51;
var OP_INCR_POST	= 52;
var OP_INCR_PRE		= 53;
var OP_DECR_POST	= 54;
var OP_DECR_PRE		= 55;

// Moderation types
var MOD_PUBLIC		= 0;
var MOD_PROTECTED	= 1;
var MOD_PRIVATE		= 2;

// Member types
var MEMBER_ATTR		= 0;
var MEMBER_FUN		= 1;

// Assertion types
var ASS_ECHO		= 0;
var ASS_FAIL		= 1;


////////////////
// EXCEPTIONS //
////////////////
function classDefNotFound(className) {
	return 'No class definition found: '+className;
}

function funRedeclare(funName) {
	return 'Cannot redeclare '+funName;
}

function expectedArrNotFound(varName) {
	return 'The variable is not an array: '+funName;
}

function funNotFound(funName) {
	return 'Function not found: '+funName;
}

function funInvalidArgCount(argCount) {
	return 'Function '+pstate.curFun+'( ) expecting '+argCount+
			' arguments, but only found '+pstate.passedParams+'.';
} 

function funNameMustBeString(intType) {
	var type = '';
	switch (intType) {
		case T_ARRAY:
			type = 'Array';
			break;
		case T_OBJECT:
			type = 'Object';
			break;
		default:
			type = 'Unknown';
			break;
	}
	return 'Function name must be string. Found: '+type;
}

function invocationTargetInvalid(intType) {
	var type = '';
	switch (intType) {
		case T_FLOAT:
		case T_INT:
		case T_CONST:
			type = 'Const';
			break;
		case T_ARRAY:
			type = 'Array';
			break;
		default:
			type = 'Unknown';
			break;
	}
	return 'The target of an invocation must be an object. Found: '+type;
}

function fetchTargetInvalid() {
	return 'The target of the variable access was not an object.';
}

function memberNotVisible(memName) {
	return 'Call to a restricted member: '+memName;
}

function nonConstAttrInit(varName, className) {
	return 'Initialization value for attributes must be constant expressions.' +
			' A non-constant expression was used for "'+varName+'" in "'+className+'"';
}

function thisRedeclare() {
	return 'Cannot redeclare $this';
}

function valInvalid(varName, refType) {
	return 'Invalid value type of '+varName+': '+refType;
}

function varNotFound(varName) {
	return 'Variable not found: '+varName;
}


///////////////
// OPERATORS //
///////////////
var ops = [];
// OP_NONE
ops[OP_NONE] = function(node) {
	if( node.children[0] )
		execute( node.children[0] );
	if( node.children[1] )
		execute( node.children[1] );
};

// OP_ASSIGN
ops[OP_ASSIGN] = function(node) {
	// $this cannot be redeclared.
	if (varName == 'this')
		throw thisRedeclare();

	// Look up potentially recursive variable name
	var varName = linker.linkRecursively(node.children[0]);

	// Check if the variable we are trying to assign to already contains an object;
	// decrement the reference count for the object if this is the case.
	var oldVal = null;
	try {
		oldVal = linker.getValue(varName);
	} catch (exception) {
		if (exception!=varNotFound(varName))
			throw exception;
		else
			oldVal = false;
	}
	
	if (oldVal && oldVal.type == T_OBJECT)
		classLinker.decrementObjectRef(linker.getValue(varName).value);
	
	try {
		var val = execute( node.children[1] );
	} catch(exception) {
		// If we get an undefined variable error, and the undefined variable is the variable
		// we are currently defining, initialize the current variable to 0, and try assigning again.
		if (exception == varNotFound(varName)) {
			execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( T_INT, 0 ) ) );
			val = execute( node.children[1] );
		} else {
			throw exception;
		}
	}
	// If we are assigning an object, increment its reference count.
	if (oldVal && oldVal.value != val.value) {
		if (oldVal && oldVal.type == T_OBJECT)
			classLinker.decrementObjectRef(linker.getValue(varName));
		
		if (val.type == T_OBJECT && oldVal.value != val.value)
			val.value.references++;
	}
	
	linker.assignVar( varName, val );
	
	return val;
};

// OP_IF
ops[OP_IF] = function(node) {
	var condChild = execute(node.children[0]);
	if(condChild.value)
		return execute(node.children[1]);
};

// OP_IF_ELSE
ops[OP_IF_ELSE] = function(node) {
	var condChild = execute(node.children[0]);
	if(condChild.value)
		return execute( node.children[1] );
	else
		return execute( node.children[2] );
};

// OP_FOR
ops[OP_FOR] = function(node){
	execute( node.children[0] );
	var tmp = execute( node.children[1] );
	var i=0;
	while( tmp.value && i<12 ) {
		execute( node.children[2] );
		execute( node.children[3] );
		tmp = execute( node.children[1] );
		i++;
	}
};
// OP_WHILE_DO
ops[OP_WHILE_DO] = function(node) {
	var tmp = execute( node.children[0] );
	while( tmp.value ) {
		execute( node.children[1] );
		tmp = execute( node.children[0] );
	}
};

// OP_DO_WHILE
ops[OP_DO_WHILE] = function(node) {
	do {
		execute( node.children[0] );
	} while( execute( node.children[1] ) );
};

// OP_FCALL
ops[OP_FCALL] = function (node) {
	// State preservation
	var prevPassedParams = pstate.passedParams;
	pstate.passedParams = 0;

	// Check if function name is recursively defined
	var funName = linker.linkRecursively(node.children[0]);
	
	var prevFun = pstate.curFun;
	
	// If any className,
	var className = '';
	if (pstate.curClass && pstate.curClass != '')
		className = pstate.curClass+'::';
	
	// Set the name of the function (possibly with class name as prefix)
	if (funName.type == T_CONST)
		pstate.curFun = className+funName.value;
	else if (typeof(funName) == 'string') 
		pstate.curFun = className+funName;
	else 
		throw funNameMustBeString(funName.type);

	// Initialize parameters for the function scope
	if ( node.children[1] )
		execute( node.children[1] );
	
	var f = pstate.funTable[pstate.curFun];
	
	// If f expects no parameters, make sure params' length attribute is set correctly
	if (!f.params.length)
		f.params.length = 0;
	
	// Execute function
	if ( f && f.params.length <= pstate.passedParams ) {
		for ( var i=0; i<f.nodes.length; i++ )
			execute( f.nodes[i] );
	} else {
		if (!f) {
			throw funNotFound(funName);
		} else if (!(f.params.length <= pstate.passedParams))
			throw funInvalidArgCount(f.params.length);
	}
	
	// Clear parameters for the function scope
	for ( var i=0; i<f.params.length; i++ )
		linker.unlinkVar( f.params[i] );
	
	// State roll-back
	pstate.passedParams = prevPassedParams;
	pstate.curFun = prevFun;
	var ret = pstate['return'];
	pstate['return'] = 0;
	
	// Return the value saved in .return in our valTable.
	return ret;
};

// OP_PASS_PARAM
ops[OP_PASS_PARAM] = function(node) {
	// Initialize parameter name
	var f = pstate.funTable[pstate.curFun];

	if (!f)
		throw funNotFound();

	// Link parameter name with passed value
	if ( node.children[0] ) {
		if ( node.children[0].type != 0 ||
				node.children[0].type == 0 && node.children[0].value != OP_PASS_PARAM ) {
			// Initialize parameter name
			var paramName = '';
			if ( pstate.passedParams < f.params.length ) {
				paramName = f.params[pstate.passedParams].value;
			} else
				paramName = '.arg'+pstate.passedParams;

			// Link
			linker.assignVar( paramName, execute( node.children[0] ) );
			pstate.passedParams++;
		} else {
			execute( node.children[0] );
		}
	}
	if ( node.children[1] ) {
		// Initialize parameter name
		var paramName = '';
		if ( pstate.passedParams < f.params.length )
			paramName = f.params[pstate.passedParams].value;
		else
			paramName = '.arg'+pstate.passedParams;
		
		// Link
		linker.assignVar( paramName, execute( node.children[1] ) );
		pstate.passedParams++;
	}
};

// OP_RETURNs
ops[OP_RETURN] = function(node) {
	if (node.children[0])
		pstate['return'] = execute( node.children[0] );
	
	pstate.term = true;
};

// OP_ECHO
ops[OP_ECHO] = function(node) {
	var val = execute( node.children[0] );
	
	if (typeof(val) != 'string' && val) {
		switch (val.type) {
			case T_INT:
			case T_FLOAT:
			case T_CONST:
				phypeOut( val.value );
				break;
			case T_ARRAY:
				phypeOut( 'Array' );
				break;
			case T_OBJECT:
				phypeOut( 'Object' );
				break;
		}
	} else {
		phypeOut( val );
	}
};

// OP_ASSIGN_ARR
ops[OP_ASSIGN_ARR] = function(node) {
	var varName = node.children[0];
	var keys = execute( node.children[1] );
	var value = execute( node.children[2] );
	
	// If keys is an (javascript) array, assign it as a multi-dimensional array.
	if (typeof(keys) == 'object' && keys.length && keys.length != 'undefined')
		linker.assignArrMulti( varName, keys, value );
	// Otherwise, assign it ordinarily.
	else
		linker.assignArr( varName, keys, value );
	
	return value;
};

// OP_FETCH_ARR
ops[OP_FETCH_ARR] = function(node) {
	var varName = node.children[0];
	var keys = execute( node.children[1] );
	
	var value = '';
	// If keys is a JS array, fetch the value as a multi-dimensional PHP array.
	if (typeof(keys) == 'object' && keys.length && keys.length != 'undefined')
		value = linker.getArrValueMulti(varName, keys);
	// Otherwise, fetch it ordinarily.
	else {
		value = linker.getArrValue(varName, keys);
	}

	return value;
};

// OP_ARR_KEYS_R
ops[OP_ARR_KEYS_R] = function(node) {
	var arrKeys = new Array();
	
	if ( node.children[0] ) {
		// If the first child contains recursive array keys, fetch the the recursively defined array keys,
		// and join these with the existing array keys.
		if ( node.children[0].value == OP_ARR_KEYS_R ) {
			arrKeys.join( execute( node.children[0] ) );
		}
		// Otherwise, insert the array key at the end of our list of array.
		else {
			arrKeys.push( execute( node.children[0] ) );
		}
	}
	
	// Add the last array key (if it exists) to the list of array keys.
	if ( node.children[1] ) {
		arrKeys.push( execute( node.children[1] ) );
	}
	
	return arrKeys;
};

// OP_OBJ_NEW
ops[OP_OBJ_NEW] = function(node) {
	// Lookup potentially recursively defined class name
	var className = linker.linkRecursively(node.children[0]);
	
	// Look up class in class table
	var realClass = pstate.classTable[node.children[0]];
	if (!realClass || typeof(realClass) == 'undefined') {
		throw classDefNotFound(node.children[0]);
	}
	
	// Instantiate attributes
	var obj = classLinker.createObjectFromClass(realClass);
	
	// Set state
	pstate.curClass = className;
	pstate.curObj = obj.objListEntry;
	
	// Get and execute constructor
	var constructInvoke = null;
	// First look for __contruct-function (higher precedence than class-named function as
	// constructor)
	if (realClass['funs']['__construct']) {
		constructInvoke = createNode( NODE_OP, OP_OBJ_FCALL, createNode( NODE_VAR, 'this' ),
								className, '__construct' );
	}
	// Then look for class-named function as constructor
	else if (realClass['funs'][className]) {
		constructInvoke = createNode( NODE_OP, OP_OBJ_FCALL, createNode( NODE_VAR, 'this' ),
								className, className );
	}
	
	// Only invoke the constructor if it is defined
	if (constructInvoke)
		execute( constructInvoke );
	
	//State rollback
	pstate.curClass = '';
	pstate.curObj = -1;
	
	// Return the instantiated object
	return createValue( T_OBJECT, obj );
};

// OP_OBJ_FCALL
ops[OP_OBJ_FCALL] = function(node) {
	var target = false;
	if (node.children[0])
		target = execute( node.children[0] );
	
	if (!target) {
		var fres = execute( createNode(NODE_OP, OP_FCALL, node.children[1], node.children[2]) );
		return fres;
	}
	
	// The function name can be defined by an expression. Execute it.
	if (typeof(node.children[1]) != 'string')
		node.children[1] = execute(node.children[1]);
	
	// Check if function name is recursively defined
	var funName = linker.linkRecursively(node.children[1]);
	
	var targetClass = null;
	var targetObj = -1;
	if (target == 'this') {
		targetClass = pstate.curClass;
		targetObj = pstate.curObj;
	} else {
		if (target.type != T_OBJECT) {
			throw invocationTargetInvalid(target.type);
		}
		
		targetClass = pstate.objList[target.value.objListEntry].value.classDef;
		targetObj = target.value.objListEntry;
	}
	
	// Invoke function
	{
		// State preservation
		var prevPassedParams = pstate.passedParams;
		pstate.passedParams = 0;
		
		// Check if function name is recursively defined
		var prevFun = pstate.curFun;
		var prevClass = pstate.curClass;
		var prevObj = pstate.curObj;
		
		// Set executing function and class
		pstate.curFun = pstate.curClass+'::'+funName;
		pstate.curClass = targetClass;
		pstate.curObj = targetObj;

		// Check visibility
		if (!classLinker.checkVisibility(pstate.curClass, targetClass, funName)) {
			throw memberNotVisible(funName);
		}
		
		// Fetch function
		var f = pstate.classTable[targetClass]['funs'][funName]['member'];
		// Initialize parameters for the function scope
		if ( node.children[2] )
			execute( node.children[2] );
		
		// If f expects no parameters, make sure params' length attribute is set correctly
		if (!f.params.length)
			f.params.length = 0;
	
		// Execute function
		if ( f && f.params.length <= pstate.passedParams ) {
			for ( var i=0; i<f.nodes.length; i++ )
				execute( f.nodes[i] );
		} else {
			if (!f) {
				throw funNotFound(funName);
			} else if (!(f.params.length <= pstate.passedParams))
				throw funInvalidArgCount(f.params.length);
		}
		
		// Clear parameters for the function scope
		for ( var i=0; i<f.params.length; i++ )
			linker.unlinkVar( f.params[i] );
		
		// State roll-back
		pstate.passedParams = prevPassedParams;
		pstate.curFun = prevFun;
		pstate.curClass = prevClass;
		pstate.curObj = prevObj;
		var ret = pstate['return'];
		pstate['return'] = 0;
		
		// Return the value saved in .return in our valTable.
		return ret;
	}
};

// OP_OBJ_FETCH
ops[OP_OBJ_FETCH] = function(node) {
	// The variable name can be defined by an expression. Execute it.
	if (typeof(node.children[1]) != 'string')
		node.children[1] = execute(node.children[1]);
	
	// Check if function name is recursively defined
	var varName = linker.linkRecursively(node.children[1]);
	
	var targetClass = null;
	var targetObj = -1;
	var target = execute( node.children[0] );
	if (target == 'this') {
		targetClass = pstate.curClass;
		targetObj = pstate.curObj;
	} else {
		if (target.type != T_OBJECT) {
			throw invocationTargetInvalid(target.type);
		}
		
		targetClass = pstate.objList[target.value.objListEntry];
		targetObj = target.value.objListEntry;
	}
	
	if (!classLinker.checkVisibility(pstate.curClass, targetClass.value.classDef, varName)) {
		throw memberNotVisible(varName);
	}
	
	if (targetObj == -1)
		throw fetchTargetInvalid();
		
	var lookupStr = pstate.symTables['.global'][targetObj+'::'+varName];
	if (lookupStr)
		var refTable = linker.getRefTableByConsDef(lookupStr.substring(0,5));
	
	if (refTable)
		return refTable[lookupStr.substring(5,lookupStr.length)];
};

// OP_ATTR_ASSIGN
ops[OP_ATTR_ASSIGN] = function(node) {
	// Look up potentially recursive variable name
	var varName = linker.linkRecursively(node.children[1]);
	
	// Figure out target object
	var targetClass = null;
	var targetObj = -1;
	var target = execute( node.children[0] );
	if (target == 'this') {
		targetClass = pstate.curClass;
		targetObj = pstate.curObj;
	} else {
		if (target.type != T_OBJECT) {
			throw invocationTargetInvalid(target.type);
		}
		
		targetClass = pstate.objList[target.value.objListEntry];
		targetObj = target.value.objListEntry;
	}
	
	if (targetObj == -1)
		throw fetchTargetInvalid();
	
	// Check if the variable we are trying to assign to already contains an object;
	// decrement the reference count for the object if this is the case.
	var oldVal = null;
	try {
		oldVal = linker.getValueFromObj(targetObj, varName);
	} catch (exception) {
		if (exception!=varNotFound(varName))
			throw exception;
		else
			oldVal = false;
	}
	
	try {
		var val = execute( node.children[2] );
	} catch(exception) {
		// If we get an undefined variable error, and the undefined variable is the variable
		// we are currently defining, initialize the current variable to 0, and try assigning again.
		if (exception == varNotFound(varName)) {
			execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( T_INT, 0 ) ) );
			val = execute( node.children[1] );
		} else {
			throw exception;
		}
	}
	
	// If we are assigning an object, increment its reference count.
	if (oldVal.value != val.value) {
		if (oldVal && oldVal.type == T_OBJECT)
			classLinker.decrementObjectRef(linker.getValue(varName));
		
		if (val.type == T_OBJECT && oldVal.value != val.value)
			val.value.references++;
	}
	
	linker.assignVar( node.children[0], val );
	
	return val;
};

// OP_EQU
ops[OP_EQU] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var resultNode;
	if (leftChild.value == rightChild.value)
		resultNode = createValue(T_INT, 1);
	else
		resultNode = createValue(T_INT, 0);
	return resultNode;
};

// OP_NEQ
ops[OP_NEQ] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var resultNode;
	if (leftChild.value != rightChild.value)
		resultNode = createValue(T_INT, 1);
	else
		resultNode = createValue(T_INT, 0);
	return resultNode;
};

// OP_GRT
ops[OP_GRT] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var resultNode;
	if (parseInt(leftChild.value) > parseInt(rightChild.value))
		resultNode = createValue(T_INT, 1);
	else
		resultNode = createValue(T_INT, 0);
	return resultNode;
};

// OP_LOT
ops[OP_LOT] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var resultNode;
	if (linker.getNumberFromNode(leftChild) < linker.getNumberFromNode(rightChild))
		resultNode = createValue(T_INT, 1);
	else
		resultNode = createValue(T_INT, 0);

	return resultNode;
};

// OP_GRE
ops[OP_GRE] = function(node) {
			var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var resultNode;
	if (linker.getNumberFromNode(leftChild) >= linker.getNumberFromNode(rightChild))
		resultNode = createValue(T_INT, 1);
	else
		resultNode = createValue(T_INT, 0);
	return resultNode;
};

// OP_LOE
ops[OP_LOE] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var resultNode;
	if (linker.getNumberFromNode(leftChild) <= linker.getNumberFromNode(rightChild))
		resultNode = createValue(T_INT, 1);
	else
		resultNode = createValue(T_INT, 0);
	return resultNode;
};
// OP_INCR_POST
ops[OP_INCR_POST] = function(node) {
	var leftChild = execute(node.children[0]);
	var leftValue;
	var type = T_INT;
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;
	}
	//Incrementation
	var result = leftValue + 1;
	execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( type, result ) ) );

	return createValue(type, result);
};

// OP_INCR_PRE
ops[OP_INCR_PRE] = function(node) {
	var leftChild = execute(node.children[0]);
	var leftValue = leftChild.value;
	var type = T_INT;
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		default:
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;		
	}
	var result = leftValue ;
	//Incrementation
	execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( type, result+1 ) ) );
	return createValue(type, result);
};

// OP_DECR_POST
ops[OP_DECR_POST] = function(node) {
	var leftChild = execute(node.children[0]);
	var leftValue;
	var type = T_INT;
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;
	}
	//Incrementation
	var result = leftValue - 1;
	execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( type, result ) ) );

	return createValue(type, result);
};

// OP_DECR_PRE
ops[OP_DECR_PRE] = function(node) {
	var leftChild = execute(node.children[0]);
	var leftValue = leftChild.value;
	var type = T_INT;
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		default:
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;		
	}
	var result = leftValue ;
	//Incrementation
	execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( type, result - 1 ) ) );
	return createValue(type, result);
};

// OP_ADD
ops[OP_ADD] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var leftValue;
	var rightValue;
	var type = T_INT;
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;
	}
	switch (rightChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			rightValue = parseInt(rightChild.value);
			break;
		case T_FLOAT:
			rightValue = parseFloat(rightChild.value);
			type = T_FLOAT;
			break;
	}

	var result = leftValue + rightValue;
	var resultNode = createValue(type, result);

	return resultNode;
};

// OP_SUB
ops[OP_SUB] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var leftValue;
	var rightValue;
	var type = T_INT;
	
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;
	}
	switch (rightChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			rightValue = parseInt(rightChild.value);
			break;
		case T_FLOAT:
			rightValue = parseFloat(rightChild.value);
			type = T_FLOAT;
			break;
	}

	var result = leftValue - rightValue;
	var resultNode = createValue(type, result);
	
	return resultNode;
};

// OP_DIV
ops[OP_DIV] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var leftValue;
	var rightValue;
	var type = T_INT;
	
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;
	}
	switch (rightChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			rightValue = parseInt(rightChild.value);
			break;
		case T_FLOAT:
			rightValue = parseFloat(rightChild.value);
			type = T_FLOAT;
			break;
	}

	var result = leftValue / rightValue;
	var resultNode = createValue(type, result);

	return resultNode;
};

// OP_MUL
ops[OP_MUL] = function(node) {
	var leftChild = execute(node.children[0]);
	var rightChild = execute(node.children[1]);
	var leftValue;
	var rightValue;
	var type = T_INT;
	
	switch (leftChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			leftValue = parseInt(leftChild.value);
			break;
		case T_FLOAT:
			leftValue = parseFloat(leftChild.value);
			type = T_FLOAT;
			break;
	}
	switch (rightChild.type) {
		// TODO: Check for PHP-standard.
		case T_INT:
		case T_CONST:
			rightValue = parseInt(rightChild.value);
			break;
		case T_FLOAT:
			rightValue = parseFloat(rightChild.value);
			type = T_FLOAT;
			break;
	}

	var result = leftValue * rightValue;
	var resultNode = createValue(type, result);
	
	return resultNode;
};

// OP_NEG
ops[OP_NEG] = function(node) {
	var child = execute(node.children[0]);
	var result = -(child.value);
	var resultNode = createValue(child.type, result);

	return resultNode;
};

// OP_CONCAT
ops[OP_CONCAT] = function(node) {
	var leftChild = execute( node.children[0] );
	var rightChild = execute( node.children[1] );

	return createValue( T_CONST, leftChild.value+rightChild.value );
};

// OP_BOOL_NEG
ops[OP_BOOL_NEG] = function(node) {
	var val = execute( node.children[0] );
	if (val.value) return createNode( NODE_INT, 0 );
	else return createNode( NODE_INT, 1 );
};

function execute( node ) {
	// Reset term-event boolean and terminate currently executing action, if a terminate-event
	// was received.
	if (pstate.term) {
		pstate.term = false;
		return;
	}
	
	var ret = null;
	
	if( !node ) {
		return null;
	}

	switch( node.type ) {
		case NODE_OP:
			var tmp = ops[node.value](node);

			if (tmp && tmp != 'undefined')
				ret = tmp;
			break;
			
		case NODE_VAR:
			ret = linker.getValue( node.value );
			break;
			
		case NODE_CONST:
			ret = createValue( T_CONST, node.value );
			break;
		
		case NODE_INT:
			ret = createValue( T_INT, node.value );
			break;
		
		case NODE_FLOAT:
			ret = createValue( T_FLOAT, node.value );
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

var PHP_dbg_withtrace		= false;
var PHP_dbg_string			= new String();

function __PHPdbg_print( text )
{
	PHP_dbg_string += text + "\n";
}

function __PHPlex( info )
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
			return 77;

		do
		{

switch( state )
{
	case 0:
		if( ( info.src.charCodeAt( pos ) >= 9 && info.src.charCodeAt( pos ) <= 10 ) || info.src.charCodeAt( pos ) == 13 || info.src.charCodeAt( pos ) == 32 ) state = 1;
		else if( info.src.charCodeAt( pos ) == 33 ) state = 2;
		else if( info.src.charCodeAt( pos ) == 40 ) state = 3;
		else if( info.src.charCodeAt( pos ) == 41 ) state = 4;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 5;
		else if( info.src.charCodeAt( pos ) == 43 ) state = 6;
		else if( info.src.charCodeAt( pos ) == 44 ) state = 7;
		else if( info.src.charCodeAt( pos ) == 45 ) state = 8;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 9;
		else if( info.src.charCodeAt( pos ) == 47 ) state = 10;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 54 ) || ( info.src.charCodeAt( pos ) >= 56 && info.src.charCodeAt( pos ) <= 57 ) ) state = 11;
		else if( info.src.charCodeAt( pos ) == 59 ) state = 12;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 13;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 14;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 15;
		else if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 77 ) || info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 81 || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 109 ) || info.src.charCodeAt( pos ) == 111 || info.src.charCodeAt( pos ) == 113 || info.src.charCodeAt( pos ) == 115 || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 91 ) state = 17;
		else if( info.src.charCodeAt( pos ) == 93 ) state = 18;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 19;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 20;
		else if( info.src.charCodeAt( pos ) == 34 ) state = 49;
		else if( info.src.charCodeAt( pos ) == 55 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 51;
		else if( info.src.charCodeAt( pos ) == 36 ) state = 52;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 53;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 54;
		else if( info.src.charCodeAt( pos ) == 58 ) state = 56;
		else if( info.src.charCodeAt( pos ) == 70 ) state = 71;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 72;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 84;
		else if( info.src.charCodeAt( pos ) == 102 ) state = 85;
		else if( info.src.charCodeAt( pos ) == 116 ) state = 86;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 95;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 96;
		else if( info.src.charCodeAt( pos ) == 80 || info.src.charCodeAt( pos ) == 112 ) state = 102;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 103;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		if( info.src.charCodeAt( pos ) == 61 ) state = 21;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 22;
		else state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 37;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 38;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 6:
		if( info.src.charCodeAt( pos ) == 43 ) state = 25;
		else state = -1;
		match = 31;
		match_pos = pos;
		break;

	case 7:
		state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 8:
		if( info.src.charCodeAt( pos ) == 45 ) state = 26;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 27;
		else state = -1;
		match = 33;
		match_pos = pos;
		break;

	case 9:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 28;
		else state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 10:
		if( info.src.charCodeAt( pos ) == 47 ) state = 29;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 58;
		else state = -1;
		match = 35;
		match_pos = pos;
		break;

	case 11:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 11;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 28;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 12:
		state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 13:
		if( info.src.charCodeAt( pos ) == 33 ) state = 31;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 32;
		else state = -1;
		match = 30;
		match_pos = pos;
		break;

	case 14:
		if( info.src.charCodeAt( pos ) == 61 ) state = 33;
		else state = -1;
		match = 21;
		match_pos = pos;
		break;

	case 15:
		if( info.src.charCodeAt( pos ) == 61 ) state = 34;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 16:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 17:
		state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 18:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 19:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 21:
		state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 22:
		state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 23:
		state = -1;
		match = 44;
		match_pos = pos;
		break;

	case 24:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 24;
		else state = -1;
		match = 42;
		match_pos = pos;
		break;

	case 25:
		state = -1;
		match = 32;
		match_pos = pos;
		break;

	case 26:
		state = -1;
		match = 34;
		match_pos = pos;
		break;

	case 27:
		state = -1;
		match = 39;
		match_pos = pos;
		break;

	case 28:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 28;
		else state = -1;
		match = 47;
		match_pos = pos;
		break;

	case 29:
		state = -1;
		match = 41;
		match_pos = pos;
		break;

	case 30:
		state = -1;
		match = 40;
		match_pos = pos;
		break;

	case 31:
		state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 32:
		state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 33:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 34:
		state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 35:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 36:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 37:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 38:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 39:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 40:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 41:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 46;
		match_pos = pos;
		break;

	case 42:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 44:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 45:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 46:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 47:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 48:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 48;
		else state = -1;
		match = 43;
		match_pos = pos;
		break;

	case 49:
		if( info.src.charCodeAt( pos ) == 34 ) state = 23;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 33 ) || ( info.src.charCodeAt( pos ) >= 35 && info.src.charCodeAt( pos ) <= 254 ) ) state = 49;
		else state = -1;
		break;

	case 50:
		if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 28;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 50;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 51:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 35;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 52:
		if( info.src.charCodeAt( pos ) == 36 || info.src.charCodeAt( pos ) == 55 || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 24;
		else state = -1;
		break;

	case 53:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 69 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 101 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 36;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 54:
		if( info.src.charCodeAt( pos ) == 39 ) state = 23;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 54;
		else state = -1;
		break;

	case 55:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 37;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 56:
		if( info.src.charCodeAt( pos ) == 58 ) state = 30;
		else state = -1;
		break;

	case 57:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 38;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 58:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 41 ) || ( info.src.charCodeAt( pos ) >= 43 && info.src.charCodeAt( pos ) <= 46 ) || ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 254 ) ) state = 58;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 60;
		else state = -1;
		break;

	case 59:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 39;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 60:
		if( info.src.charCodeAt( pos ) == 47 ) state = 1;
		else state = -1;
		break;

	case 61:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 40;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 62:
		if( info.src.charCodeAt( pos ) == 55 || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 48;
		else state = -1;
		break;

	case 63:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 101 ) state = 41;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 64:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 42;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 65:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 43;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 66:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 44;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 67:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 45;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 68:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 46;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 69:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 47;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 70:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 32 ) state = 62;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 71:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 55;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 72:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 57;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 73:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 59;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 74:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 61;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 75:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 117 ) state = 63;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 76:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 64;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 77:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 65;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 78:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 115 ) state = 63;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 79:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 66;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 80:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 67;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 81:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 68;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 82:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 69;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 83:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 110 ) state = 70;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 84:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 73;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 74;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 85:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 55;
		else if( info.src.charCodeAt( pos ) == 97 ) state = 89;
		else if( info.src.charCodeAt( pos ) == 117 ) state = 109;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 86:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 114 ) state = 75;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 87:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 76;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 88:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 77;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 89:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 108 ) state = 78;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 90:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 79;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 91:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 80;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 92:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 81;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 93:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 82;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 94:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 111 ) state = 83;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 95:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 87;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 96:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 88;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 97:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || info.src.charCodeAt( pos ) == 65 || ( info.src.charCodeAt( pos ) >= 67 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || info.src.charCodeAt( pos ) == 97 || ( info.src.charCodeAt( pos ) >= 99 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 66 || info.src.charCodeAt( pos ) == 98 ) state = 90;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 98:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 91;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 99:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 85 ) || ( info.src.charCodeAt( pos ) >= 87 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 117 ) || ( info.src.charCodeAt( pos ) >= 119 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 86 || info.src.charCodeAt( pos ) == 118 ) state = 92;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 100:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 93;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 101:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 105 ) state = 94;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 102:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 97;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 104;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 103:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 98;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 104:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 99;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 107;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 105:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 100;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 106:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 116 ) state = 101;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 107:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 105;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 108:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 99 ) state = 106;
		else state = -1;
		match = 48;
		match_pos = pos;
		break;

	case 109:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 110 ) state = 108;
		else state = -1;
		match = 48;
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
	case 42:
		{
		 info.att = info.att.substr(1,info.att.length-1); 
		}
		break;

	case 43:
		{
		 info.att = info.att.substr(9,info.att.length-1); 
		}
		break;

	case 44:
		{
		
											info.att = info.att.substr(1,info.att.length-2);
											info.att = info.att.replace( /\\'/g, "'" );
										
		}
		break;

	case 46:
		{
		
											if (info.att == 'true')
												info.att = 1;
											else 
												info.att = 0;
										
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


function __PHPparse( src, err_off, err_la )
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
	new Array( 0/* PHPScript' */, 1 ),
	new Array( 49/* PHPScript */, 2 ),
	new Array( 49/* PHPScript */, 0 ),
	new Array( 52/* ClassDefinition */, 5 ),
	new Array( 51/* Member */, 2 ),
	new Array( 51/* Member */, 2 ),
	new Array( 51/* Member */, 0 ),
	new Array( 55/* AttributeMod */, 1 ),
	new Array( 55/* AttributeMod */, 1 ),
	new Array( 55/* AttributeMod */, 1 ),
	new Array( 56/* FunctionMod */, 1 ),
	new Array( 56/* FunctionMod */, 0 ),
	new Array( 56/* FunctionMod */, 1 ),
	new Array( 56/* FunctionMod */, 1 ),
	new Array( 58/* FunctionDefinition */, 7 ),
	new Array( 54/* ClassFunctionDefinition */, 8 ),
	new Array( 53/* AttributeDefinition */, 3 ),
	new Array( 53/* AttributeDefinition */, 5 ),
	new Array( 62/* SingleStmt */, 2 ),
	new Array( 62/* SingleStmt */, 2 ),
	new Array( 62/* SingleStmt */, 2 ),
	new Array( 62/* SingleStmt */, 3 ),
	new Array( 62/* SingleStmt */, 5 ),
	new Array( 62/* SingleStmt */, 3 ),
	new Array( 62/* SingleStmt */, 9 ),
	new Array( 62/* SingleStmt */, 5 ),
	new Array( 62/* SingleStmt */, 3 ),
	new Array( 62/* SingleStmt */, 5 ),
	new Array( 62/* SingleStmt */, 3 ),
	new Array( 50/* Stmt */, 2 ),
	new Array( 50/* Stmt */, 1 ),
	new Array( 50/* Stmt */, 1 ),
	new Array( 50/* Stmt */, 1 ),
	new Array( 61/* AssignmentStmt */, 3 ),
	new Array( 61/* AssignmentStmt */, 5 ),
	new Array( 57/* FormalParameterList */, 3 ),
	new Array( 57/* FormalParameterList */, 1 ),
	new Array( 57/* FormalParameterList */, 0 ),
	new Array( 60/* Return */, 2 ),
	new Array( 60/* Return */, 1 ),
	new Array( 69/* ExpressionNotFunAccess */, 1 ),
	new Array( 69/* ExpressionNotFunAccess */, 1 ),
	new Array( 69/* ExpressionNotFunAccess */, 1 ),
	new Array( 69/* ExpressionNotFunAccess */, 2 ),
	new Array( 69/* ExpressionNotFunAccess */, 4 ),
	new Array( 69/* ExpressionNotFunAccess */, 3 ),
	new Array( 64/* LValue */, 1 ),
	new Array( 64/* LValue */, 1 ),
	new Array( 64/* LValue */, 2 ),
	new Array( 59/* Expression */, 1 ),
	new Array( 59/* Expression */, 1 ),
	new Array( 59/* Expression */, 0 ),
	new Array( 67/* FunctionInvoke */, 2 ),
	new Array( 67/* FunctionInvoke */, 2 ),
	new Array( 70/* MemberAccess */, 1 ),
	new Array( 70/* MemberAccess */, 1 ),
	new Array( 65/* AttributeAccess */, 3 ),
	new Array( 65/* AttributeAccess */, 3 ),
	new Array( 72/* FunctionAccess */, 5 ),
	new Array( 72/* FunctionAccess */, 3 ),
	new Array( 68/* ActualParameterList */, 3 ),
	new Array( 68/* ActualParameterList */, 1 ),
	new Array( 68/* ActualParameterList */, 0 ),
	new Array( 63/* ArrayIndices */, 4 ),
	new Array( 63/* ArrayIndices */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 3 ),
	new Array( 66/* BinaryExp */, 1 ),
	new Array( 73/* AddSubExp */, 3 ),
	new Array( 73/* AddSubExp */, 3 ),
	new Array( 73/* AddSubExp */, 2 ),
	new Array( 73/* AddSubExp */, 2 ),
	new Array( 73/* AddSubExp */, 2 ),
	new Array( 73/* AddSubExp */, 2 ),
	new Array( 73/* AddSubExp */, 3 ),
	new Array( 73/* AddSubExp */, 1 ),
	new Array( 74/* MulDivExp */, 3 ),
	new Array( 74/* MulDivExp */, 3 ),
	new Array( 74/* MulDivExp */, 3 ),
	new Array( 74/* MulDivExp */, 1 ),
	new Array( 75/* UnaryExp */, 2 ),
	new Array( 75/* UnaryExp */, 2 ),
	new Array( 75/* UnaryExp */, 1 ),
	new Array( 71/* VarVal */, 1 ),
	new Array( 76/* Value */, 1 ),
	new Array( 76/* Value */, 1 ),
	new Array( 76/* Value */, 1 ),
	new Array( 76/* Value */, 1 ),
	new Array( 76/* Value */, 1 ),
	new Array( 76/* Value */, 1 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 77/* "$" */,-2 , 8/* "RETURN" */,-2 , 42/* "Variable" */,-2 , 18/* ";" */,-2 , 2/* "IF" */,-2 , 4/* "WHILE" */,-2 , 6/* "FOR" */,-2 , 5/* "DO" */,-2 , 7/* "ECHO" */,-2 , 14/* "{" */,-2 , 10/* "ClassToken" */,-2 , 43/* "FunctionName" */,-2 , 20/* "." */,-2 , 37/* "(" */,-2 , 9/* "NewToken" */,-2 , 48/* "Identifier" */,-2 , 32/* "++" */,-2 , 34/* "--" */,-2 , 33/* "-" */,-2 , 22/* "!" */,-2 , 44/* "String" */,-2 , 45/* "Integer" */,-2 , 46/* "Boolean" */,-2 , 47/* "Float" */,-2 ),
	/* State 1 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 77/* "$" */,0 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 2 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 77/* "$" */,-1 , 18/* ";" */,-1 , 20/* "." */,-1 ),
	/* State 3 */ new Array( 77/* "$" */,-30 , 8/* "RETURN" */,-30 , 42/* "Variable" */,-30 , 18/* ";" */,-30 , 2/* "IF" */,-30 , 4/* "WHILE" */,-30 , 6/* "FOR" */,-30 , 5/* "DO" */,-30 , 7/* "ECHO" */,-30 , 14/* "{" */,-30 , 10/* "ClassToken" */,-30 , 43/* "FunctionName" */,-30 , 20/* "." */,-30 , 37/* "(" */,-30 , 9/* "NewToken" */,-30 , 48/* "Identifier" */,-30 , 32/* "++" */,-30 , 34/* "--" */,-30 , 33/* "-" */,-30 , 22/* "!" */,-30 , 44/* "String" */,-30 , 45/* "Integer" */,-30 , 46/* "Boolean" */,-30 , 47/* "Float" */,-30 , 15/* "}" */,-30 ),
	/* State 4 */ new Array( 77/* "$" */,-31 , 8/* "RETURN" */,-31 , 42/* "Variable" */,-31 , 18/* ";" */,-31 , 2/* "IF" */,-31 , 4/* "WHILE" */,-31 , 6/* "FOR" */,-31 , 5/* "DO" */,-31 , 7/* "ECHO" */,-31 , 14/* "{" */,-31 , 10/* "ClassToken" */,-31 , 43/* "FunctionName" */,-31 , 20/* "." */,-31 , 37/* "(" */,-31 , 9/* "NewToken" */,-31 , 48/* "Identifier" */,-31 , 32/* "++" */,-31 , 34/* "--" */,-31 , 33/* "-" */,-31 , 22/* "!" */,-31 , 44/* "String" */,-31 , 45/* "Integer" */,-31 , 46/* "Boolean" */,-31 , 47/* "Float" */,-31 , 15/* "}" */,-31 ),
	/* State 5 */ new Array( 77/* "$" */,-32 , 8/* "RETURN" */,-32 , 42/* "Variable" */,-32 , 18/* ";" */,-32 , 2/* "IF" */,-32 , 4/* "WHILE" */,-32 , 6/* "FOR" */,-32 , 5/* "DO" */,-32 , 7/* "ECHO" */,-32 , 14/* "{" */,-32 , 10/* "ClassToken" */,-32 , 43/* "FunctionName" */,-32 , 20/* "." */,-32 , 37/* "(" */,-32 , 9/* "NewToken" */,-32 , 48/* "Identifier" */,-32 , 32/* "++" */,-32 , 34/* "--" */,-32 , 33/* "-" */,-32 , 22/* "!" */,-32 , 44/* "String" */,-32 , 45/* "Integer" */,-32 , 46/* "Boolean" */,-32 , 47/* "Float" */,-32 , 15/* "}" */,-32 ),
	/* State 6 */ new Array( 18/* ";" */,43 ),
	/* State 7 */ new Array( 18/* ";" */,44 , 20/* "." */,-41 ),
	/* State 8 */ new Array( 20/* "." */,45 , 18/* ";" */,46 ),
	/* State 9 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 8/* "RETURN" */,-51 , 18/* ";" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 20/* "." */,-51 ),
	/* State 10 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 8/* "RETURN" */,-51 , 18/* ";" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 20/* "." */,-51 ),
	/* State 11 */ new Array( 37/* "(" */,51 ),
	/* State 12 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 13 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 14 */ new Array( 34/* "--" */,54 , 32/* "++" */,55 , 21/* "=" */,57 , 16/* "[" */,58 , 39/* "->" */,-89 , 18/* ";" */,-89 , 23/* "==" */,-89 , 30/* "<" */,-89 , 29/* ">" */,-89 , 27/* "<=" */,-89 , 28/* ">=" */,-89 , 24/* "!=" */,-89 , 33/* "-" */,-89 , 31/* "+" */,-89 , 36/* "*" */,-89 , 35/* "/" */,-89 , 37/* "(" */,-89 , 20/* "." */,-89 ),
	/* State 15 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 16 */ new Array( 48/* "Identifier" */,60 ),
	/* State 17 */ new Array( 37/* "(" */,61 ),
	/* State 18 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-39 , 20/* "." */,-51 ),
	/* State 19 */ new Array( 37/* "(" */,63 , 39/* "->" */,64 , 18/* ";" */,-95 , 23/* "==" */,-95 , 30/* "<" */,-95 , 29/* ">" */,-95 , 27/* "<=" */,-95 , 28/* ">=" */,-95 , 24/* "!=" */,-95 , 33/* "-" */,-95 , 31/* "+" */,-95 , 36/* "*" */,-95 , 35/* "/" */,-95 , 20/* "." */,-95 , 8/* "RETURN" */,-95 , 42/* "Variable" */,-95 , 2/* "IF" */,-95 , 4/* "WHILE" */,-95 , 6/* "FOR" */,-95 , 5/* "DO" */,-95 , 7/* "ECHO" */,-95 , 14/* "{" */,-95 , 9/* "NewToken" */,-95 , 48/* "Identifier" */,-95 , 32/* "++" */,-95 , 34/* "--" */,-95 , 22/* "!" */,-95 , 44/* "String" */,-95 , 45/* "Integer" */,-95 , 46/* "Boolean" */,-95 , 47/* "Float" */,-95 , 38/* ")" */,-95 , 19/* "," */,-95 , 17/* "]" */,-95 ),
	/* State 20 */ new Array( 18/* ";" */,-49 , 20/* "." */,-49 , 8/* "RETURN" */,-49 , 42/* "Variable" */,-49 , 2/* "IF" */,-49 , 4/* "WHILE" */,-49 , 6/* "FOR" */,-49 , 5/* "DO" */,-49 , 7/* "ECHO" */,-49 , 14/* "{" */,-49 , 37/* "(" */,-49 , 9/* "NewToken" */,-49 , 48/* "Identifier" */,-49 , 32/* "++" */,-49 , 34/* "--" */,-49 , 33/* "-" */,-49 , 22/* "!" */,-49 , 44/* "String" */,-49 , 45/* "Integer" */,-49 , 46/* "Boolean" */,-49 , 47/* "Float" */,-49 , 38/* ")" */,-49 , 19/* "," */,-49 , 23/* "==" */,-49 , 30/* "<" */,-49 , 29/* ">" */,-49 , 27/* "<=" */,-49 , 28/* ">=" */,-49 , 24/* "!=" */,-49 , 31/* "+" */,-49 , 36/* "*" */,-49 , 35/* "/" */,-49 , 17/* "]" */,-49 , 39/* "->" */,-49 ),
	/* State 21 */ new Array( 18/* ";" */,-50 , 20/* "." */,-50 , 8/* "RETURN" */,-50 , 42/* "Variable" */,-50 , 2/* "IF" */,-50 , 4/* "WHILE" */,-50 , 6/* "FOR" */,-50 , 5/* "DO" */,-50 , 7/* "ECHO" */,-50 , 14/* "{" */,-50 , 37/* "(" */,-50 , 9/* "NewToken" */,-50 , 48/* "Identifier" */,-50 , 32/* "++" */,-50 , 34/* "--" */,-50 , 33/* "-" */,-50 , 22/* "!" */,-50 , 44/* "String" */,-50 , 45/* "Integer" */,-50 , 46/* "Boolean" */,-50 , 47/* "Float" */,-50 , 38/* ")" */,-50 , 19/* "," */,-50 , 23/* "==" */,-50 , 30/* "<" */,-50 , 29/* ">" */,-50 , 27/* "<=" */,-50 , 28/* ">=" */,-50 , 24/* "!=" */,-50 , 31/* "+" */,-50 , 36/* "*" */,-50 , 35/* "/" */,-50 , 17/* "]" */,-50 , 39/* "->" */,-50 ),
	/* State 22 */ new Array( 39/* "->" */,-46 , 37/* "(" */,-46 , 18/* ";" */,-46 , 23/* "==" */,-46 , 30/* "<" */,-46 , 29/* ">" */,-46 , 27/* "<=" */,-46 , 28/* ">=" */,-46 , 24/* "!=" */,-46 , 33/* "-" */,-46 , 31/* "+" */,-46 , 36/* "*" */,-46 , 35/* "/" */,-46 , 20/* "." */,-46 , 8/* "RETURN" */,-46 , 42/* "Variable" */,-46 , 2/* "IF" */,-46 , 4/* "WHILE" */,-46 , 6/* "FOR" */,-46 , 5/* "DO" */,-46 , 7/* "ECHO" */,-46 , 14/* "{" */,-46 , 9/* "NewToken" */,-46 , 48/* "Identifier" */,-46 , 32/* "++" */,-46 , 34/* "--" */,-46 , 22/* "!" */,-46 , 44/* "String" */,-46 , 45/* "Integer" */,-46 , 46/* "Boolean" */,-46 , 47/* "Float" */,-46 , 38/* ")" */,-46 , 19/* "," */,-46 , 17/* "]" */,-46 ),
	/* State 23 */ new Array( 16/* "[" */,58 , 39/* "->" */,-47 , 37/* "(" */,-47 , 18/* ";" */,-47 , 23/* "==" */,-47 , 30/* "<" */,-47 , 29/* ">" */,-47 , 27/* "<=" */,-47 , 28/* ">=" */,-47 , 24/* "!=" */,-47 , 33/* "-" */,-47 , 31/* "+" */,-47 , 36/* "*" */,-47 , 35/* "/" */,-47 , 20/* "." */,-47 , 8/* "RETURN" */,-47 , 42/* "Variable" */,-47 , 2/* "IF" */,-47 , 4/* "WHILE" */,-47 , 6/* "FOR" */,-47 , 5/* "DO" */,-47 , 7/* "ECHO" */,-47 , 14/* "{" */,-47 , 9/* "NewToken" */,-47 , 48/* "Identifier" */,-47 , 32/* "++" */,-47 , 34/* "--" */,-47 , 22/* "!" */,-47 , 44/* "String" */,-47 , 45/* "Integer" */,-47 , 46/* "Boolean" */,-47 , 47/* "Float" */,-47 , 38/* ")" */,-47 , 19/* "," */,-47 , 17/* "]" */,-47 ),
	/* State 24 */ new Array( 24/* "!=" */,66 , 28/* ">=" */,67 , 27/* "<=" */,68 , 29/* ">" */,69 , 30/* "<" */,70 , 23/* "==" */,71 , 18/* ";" */,-40 , 20/* "." */,-40 , 8/* "RETURN" */,-40 , 42/* "Variable" */,-40 , 2/* "IF" */,-40 , 4/* "WHILE" */,-40 , 6/* "FOR" */,-40 , 5/* "DO" */,-40 , 7/* "ECHO" */,-40 , 14/* "{" */,-40 , 37/* "(" */,-40 , 9/* "NewToken" */,-40 , 48/* "Identifier" */,-40 , 32/* "++" */,-40 , 34/* "--" */,-40 , 33/* "-" */,-40 , 22/* "!" */,-40 , 44/* "String" */,-40 , 45/* "Integer" */,-40 , 46/* "Boolean" */,-40 , 47/* "Float" */,-40 , 38/* ")" */,-40 , 19/* "," */,-40 , 31/* "+" */,-40 , 36/* "*" */,-40 , 35/* "/" */,-40 , 17/* "]" */,-40 , 39/* "->" */,-40 ),
	/* State 25 */ new Array( 18/* ";" */,-42 , 20/* "." */,-42 , 8/* "RETURN" */,-42 , 42/* "Variable" */,-42 , 2/* "IF" */,-42 , 4/* "WHILE" */,-42 , 6/* "FOR" */,-42 , 5/* "DO" */,-42 , 7/* "ECHO" */,-42 , 14/* "{" */,-42 , 37/* "(" */,-42 , 9/* "NewToken" */,-42 , 48/* "Identifier" */,-42 , 32/* "++" */,-42 , 34/* "--" */,-42 , 33/* "-" */,-42 , 22/* "!" */,-42 , 44/* "String" */,-42 , 45/* "Integer" */,-42 , 46/* "Boolean" */,-42 , 47/* "Float" */,-42 , 38/* ")" */,-42 , 19/* "," */,-42 , 23/* "==" */,-42 , 30/* "<" */,-42 , 29/* ">" */,-42 , 27/* "<=" */,-42 , 28/* ">=" */,-42 , 24/* "!=" */,-42 , 31/* "+" */,-42 , 36/* "*" */,-42 , 35/* "/" */,-42 , 17/* "]" */,-42 , 39/* "->" */,-42 ),
	/* State 26 */ new Array( 48/* "Identifier" */,30 , 42/* "Variable" */,77 ),
	/* State 27 */ new Array( 37/* "(" */,27 , 42/* "Variable" */,49 , 32/* "++" */,31 , 34/* "--" */,32 , 9/* "NewToken" */,26 , 33/* "-" */,35 , 22/* "!" */,36 , 48/* "Identifier" */,30 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 38/* ")" */,-51 , 20/* "." */,-51 ),
	/* State 28 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 38/* ")" */,-51 , 19/* "," */,-51 , 20/* "." */,-51 ),
	/* State 29 */ new Array( 31/* "+" */,84 , 33/* "-" */,85 , 18/* ";" */,-73 , 23/* "==" */,-73 , 30/* "<" */,-73 , 29/* ">" */,-73 , 27/* "<=" */,-73 , 28/* ">=" */,-73 , 24/* "!=" */,-73 , 20/* "." */,-73 , 8/* "RETURN" */,-73 , 42/* "Variable" */,-73 , 2/* "IF" */,-73 , 4/* "WHILE" */,-73 , 6/* "FOR" */,-73 , 5/* "DO" */,-73 , 7/* "ECHO" */,-73 , 14/* "{" */,-73 , 37/* "(" */,-73 , 9/* "NewToken" */,-73 , 48/* "Identifier" */,-73 , 32/* "++" */,-73 , 34/* "--" */,-73 , 22/* "!" */,-73 , 44/* "String" */,-73 , 45/* "Integer" */,-73 , 46/* "Boolean" */,-73 , 47/* "Float" */,-73 , 38/* ")" */,-73 , 19/* "," */,-73 , 36/* "*" */,-73 , 35/* "/" */,-73 , 17/* "]" */,-73 , 39/* "->" */,-73 ),
	/* State 30 */ new Array( 37/* "(" */,86 ),
	/* State 31 */ new Array( 42/* "Variable" */,87 ),
	/* State 32 */ new Array( 42/* "Variable" */,88 ),
	/* State 33 */ new Array( 35/* "/" */,89 , 36/* "*" */,90 , 18/* ";" */,-81 , 23/* "==" */,-81 , 30/* "<" */,-81 , 29/* ">" */,-81 , 27/* "<=" */,-81 , 28/* ">=" */,-81 , 24/* "!=" */,-81 , 33/* "-" */,-81 , 31/* "+" */,-81 , 20/* "." */,-81 , 8/* "RETURN" */,-81 , 42/* "Variable" */,-81 , 2/* "IF" */,-81 , 4/* "WHILE" */,-81 , 6/* "FOR" */,-81 , 5/* "DO" */,-81 , 7/* "ECHO" */,-81 , 14/* "{" */,-81 , 37/* "(" */,-81 , 9/* "NewToken" */,-81 , 48/* "Identifier" */,-81 , 32/* "++" */,-81 , 34/* "--" */,-81 , 22/* "!" */,-81 , 44/* "String" */,-81 , 45/* "Integer" */,-81 , 46/* "Boolean" */,-81 , 47/* "Float" */,-81 , 38/* ")" */,-81 , 19/* "," */,-81 , 17/* "]" */,-81 , 39/* "->" */,-81 ),
	/* State 34 */ new Array( 18/* ";" */,-85 , 23/* "==" */,-85 , 30/* "<" */,-85 , 29/* ">" */,-85 , 27/* "<=" */,-85 , 28/* ">=" */,-85 , 24/* "!=" */,-85 , 33/* "-" */,-85 , 31/* "+" */,-85 , 36/* "*" */,-85 , 35/* "/" */,-85 , 20/* "." */,-85 , 8/* "RETURN" */,-85 , 42/* "Variable" */,-85 , 2/* "IF" */,-85 , 4/* "WHILE" */,-85 , 6/* "FOR" */,-85 , 5/* "DO" */,-85 , 7/* "ECHO" */,-85 , 14/* "{" */,-85 , 37/* "(" */,-85 , 9/* "NewToken" */,-85 , 48/* "Identifier" */,-85 , 32/* "++" */,-85 , 34/* "--" */,-85 , 22/* "!" */,-85 , 44/* "String" */,-85 , 45/* "Integer" */,-85 , 46/* "Boolean" */,-85 , 47/* "Float" */,-85 , 38/* ")" */,-85 , 19/* "," */,-85 , 17/* "]" */,-85 , 39/* "->" */,-85 ),
	/* State 35 */ new Array( 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 42/* "Variable" */,77 , 48/* "Identifier" */,30 ),
	/* State 36 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 ),
	/* State 37 */ new Array( 18/* ";" */,-88 , 23/* "==" */,-88 , 30/* "<" */,-88 , 29/* ">" */,-88 , 27/* "<=" */,-88 , 28/* ">=" */,-88 , 24/* "!=" */,-88 , 33/* "-" */,-88 , 31/* "+" */,-88 , 36/* "*" */,-88 , 35/* "/" */,-88 , 20/* "." */,-88 , 8/* "RETURN" */,-88 , 42/* "Variable" */,-88 , 2/* "IF" */,-88 , 4/* "WHILE" */,-88 , 6/* "FOR" */,-88 , 5/* "DO" */,-88 , 7/* "ECHO" */,-88 , 14/* "{" */,-88 , 37/* "(" */,-88 , 9/* "NewToken" */,-88 , 48/* "Identifier" */,-88 , 32/* "++" */,-88 , 34/* "--" */,-88 , 22/* "!" */,-88 , 44/* "String" */,-88 , 45/* "Integer" */,-88 , 46/* "Boolean" */,-88 , 47/* "Float" */,-88 , 38/* ")" */,-88 , 19/* "," */,-88 , 17/* "]" */,-88 , 39/* "->" */,-88 ),
	/* State 38 */ new Array( 18/* ";" */,-91 , 23/* "==" */,-91 , 30/* "<" */,-91 , 29/* ">" */,-91 , 27/* "<=" */,-91 , 28/* ">=" */,-91 , 24/* "!=" */,-91 , 33/* "-" */,-91 , 31/* "+" */,-91 , 36/* "*" */,-91 , 35/* "/" */,-91 , 20/* "." */,-91 , 8/* "RETURN" */,-91 , 42/* "Variable" */,-91 , 2/* "IF" */,-91 , 4/* "WHILE" */,-91 , 6/* "FOR" */,-91 , 5/* "DO" */,-91 , 7/* "ECHO" */,-91 , 14/* "{" */,-91 , 37/* "(" */,-91 , 9/* "NewToken" */,-91 , 48/* "Identifier" */,-91 , 32/* "++" */,-91 , 34/* "--" */,-91 , 22/* "!" */,-91 , 44/* "String" */,-91 , 45/* "Integer" */,-91 , 46/* "Boolean" */,-91 , 47/* "Float" */,-91 , 38/* ")" */,-91 , 19/* "," */,-91 , 17/* "]" */,-91 , 39/* "->" */,-91 ),
	/* State 39 */ new Array( 18/* ";" */,-92 , 23/* "==" */,-92 , 30/* "<" */,-92 , 29/* ">" */,-92 , 27/* "<=" */,-92 , 28/* ">=" */,-92 , 24/* "!=" */,-92 , 33/* "-" */,-92 , 31/* "+" */,-92 , 36/* "*" */,-92 , 35/* "/" */,-92 , 20/* "." */,-92 , 8/* "RETURN" */,-92 , 42/* "Variable" */,-92 , 2/* "IF" */,-92 , 4/* "WHILE" */,-92 , 6/* "FOR" */,-92 , 5/* "DO" */,-92 , 7/* "ECHO" */,-92 , 14/* "{" */,-92 , 37/* "(" */,-92 , 9/* "NewToken" */,-92 , 48/* "Identifier" */,-92 , 32/* "++" */,-92 , 34/* "--" */,-92 , 22/* "!" */,-92 , 44/* "String" */,-92 , 45/* "Integer" */,-92 , 46/* "Boolean" */,-92 , 47/* "Float" */,-92 , 38/* ")" */,-92 , 19/* "," */,-92 , 17/* "]" */,-92 , 39/* "->" */,-92 ),
	/* State 40 */ new Array( 18/* ";" */,-93 , 23/* "==" */,-93 , 30/* "<" */,-93 , 29/* ">" */,-93 , 27/* "<=" */,-93 , 28/* ">=" */,-93 , 24/* "!=" */,-93 , 33/* "-" */,-93 , 31/* "+" */,-93 , 36/* "*" */,-93 , 35/* "/" */,-93 , 20/* "." */,-93 , 8/* "RETURN" */,-93 , 42/* "Variable" */,-93 , 2/* "IF" */,-93 , 4/* "WHILE" */,-93 , 6/* "FOR" */,-93 , 5/* "DO" */,-93 , 7/* "ECHO" */,-93 , 14/* "{" */,-93 , 37/* "(" */,-93 , 9/* "NewToken" */,-93 , 48/* "Identifier" */,-93 , 32/* "++" */,-93 , 34/* "--" */,-93 , 22/* "!" */,-93 , 44/* "String" */,-93 , 45/* "Integer" */,-93 , 46/* "Boolean" */,-93 , 47/* "Float" */,-93 , 38/* ")" */,-93 , 19/* "," */,-93 , 17/* "]" */,-93 , 39/* "->" */,-93 ),
	/* State 41 */ new Array( 18/* ";" */,-94 , 23/* "==" */,-94 , 30/* "<" */,-94 , 29/* ">" */,-94 , 27/* "<=" */,-94 , 28/* ">=" */,-94 , 24/* "!=" */,-94 , 33/* "-" */,-94 , 31/* "+" */,-94 , 36/* "*" */,-94 , 35/* "/" */,-94 , 20/* "." */,-94 , 8/* "RETURN" */,-94 , 42/* "Variable" */,-94 , 2/* "IF" */,-94 , 4/* "WHILE" */,-94 , 6/* "FOR" */,-94 , 5/* "DO" */,-94 , 7/* "ECHO" */,-94 , 14/* "{" */,-94 , 37/* "(" */,-94 , 9/* "NewToken" */,-94 , 48/* "Identifier" */,-94 , 32/* "++" */,-94 , 34/* "--" */,-94 , 22/* "!" */,-94 , 44/* "String" */,-94 , 45/* "Integer" */,-94 , 46/* "Boolean" */,-94 , 47/* "Float" */,-94 , 38/* ")" */,-94 , 19/* "," */,-94 , 17/* "]" */,-94 , 39/* "->" */,-94 ),
	/* State 42 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 77/* "$" */,-29 , 18/* ";" */,-29 , 20/* "." */,-29 , 15/* "}" */,-29 ),
	/* State 43 */ new Array( 77/* "$" */,-18 , 8/* "RETURN" */,-18 , 42/* "Variable" */,-18 , 18/* ";" */,-18 , 2/* "IF" */,-18 , 4/* "WHILE" */,-18 , 6/* "FOR" */,-18 , 5/* "DO" */,-18 , 7/* "ECHO" */,-18 , 14/* "{" */,-18 , 10/* "ClassToken" */,-18 , 43/* "FunctionName" */,-18 , 20/* "." */,-18 , 37/* "(" */,-18 , 9/* "NewToken" */,-18 , 48/* "Identifier" */,-18 , 32/* "++" */,-18 , 34/* "--" */,-18 , 33/* "-" */,-18 , 22/* "!" */,-18 , 44/* "String" */,-18 , 45/* "Integer" */,-18 , 46/* "Boolean" */,-18 , 47/* "Float" */,-18 , 15/* "}" */,-18 , 3/* "ELSE" */,-18 ),
	/* State 44 */ new Array( 77/* "$" */,-19 , 8/* "RETURN" */,-19 , 42/* "Variable" */,-19 , 18/* ";" */,-19 , 2/* "IF" */,-19 , 4/* "WHILE" */,-19 , 6/* "FOR" */,-19 , 5/* "DO" */,-19 , 7/* "ECHO" */,-19 , 14/* "{" */,-19 , 10/* "ClassToken" */,-19 , 43/* "FunctionName" */,-19 , 20/* "." */,-19 , 37/* "(" */,-19 , 9/* "NewToken" */,-19 , 48/* "Identifier" */,-19 , 32/* "++" */,-19 , 34/* "--" */,-19 , 33/* "-" */,-19 , 22/* "!" */,-19 , 44/* "String" */,-19 , 45/* "Integer" */,-19 , 46/* "Boolean" */,-19 , 47/* "Float" */,-19 , 15/* "}" */,-19 , 3/* "ELSE" */,-19 ),
	/* State 45 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 20/* "." */,-51 ),
	/* State 46 */ new Array( 77/* "$" */,-20 , 8/* "RETURN" */,-20 , 42/* "Variable" */,-20 , 18/* ";" */,-20 , 2/* "IF" */,-20 , 4/* "WHILE" */,-20 , 6/* "FOR" */,-20 , 5/* "DO" */,-20 , 7/* "ECHO" */,-20 , 14/* "{" */,-20 , 10/* "ClassToken" */,-20 , 43/* "FunctionName" */,-20 , 20/* "." */,-20 , 37/* "(" */,-20 , 9/* "NewToken" */,-20 , 48/* "Identifier" */,-20 , 32/* "++" */,-20 , 34/* "--" */,-20 , 33/* "-" */,-20 , 22/* "!" */,-20 , 44/* "String" */,-20 , 45/* "Integer" */,-20 , 46/* "Boolean" */,-20 , 47/* "Float" */,-20 , 15/* "}" */,-20 , 3/* "ELSE" */,-20 ),
	/* State 47 */ new Array( 20/* "." */,45 , 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 ),
	/* State 48 */ new Array( 8/* "RETURN" */,-41 , 42/* "Variable" */,-41 , 18/* ";" */,-41 , 2/* "IF" */,-41 , 4/* "WHILE" */,-41 , 6/* "FOR" */,-41 , 5/* "DO" */,-41 , 7/* "ECHO" */,-41 , 14/* "{" */,-41 , 20/* "." */,-41 , 37/* "(" */,-41 , 9/* "NewToken" */,-41 , 48/* "Identifier" */,-41 , 32/* "++" */,-41 , 34/* "--" */,-41 , 33/* "-" */,-41 , 22/* "!" */,-41 , 44/* "String" */,-41 , 45/* "Integer" */,-41 , 46/* "Boolean" */,-41 , 47/* "Float" */,-41 , 38/* ")" */,-41 , 19/* "," */,-41 , 23/* "==" */,-41 , 30/* "<" */,-41 , 29/* ">" */,-41 , 27/* "<=" */,-41 , 28/* ">=" */,-41 , 24/* "!=" */,-41 , 31/* "+" */,-41 , 36/* "*" */,-41 , 35/* "/" */,-41 , 17/* "]" */,-41 , 39/* "->" */,-41 ),
	/* State 49 */ new Array( 34/* "--" */,54 , 32/* "++" */,55 , 21/* "=" */,57 , 16/* "[" */,58 , 39/* "->" */,-89 , 8/* "RETURN" */,-89 , 42/* "Variable" */,-89 , 18/* ";" */,-89 , 2/* "IF" */,-89 , 4/* "WHILE" */,-89 , 6/* "FOR" */,-89 , 5/* "DO" */,-89 , 7/* "ECHO" */,-89 , 14/* "{" */,-89 , 20/* "." */,-89 , 37/* "(" */,-89 , 9/* "NewToken" */,-89 , 48/* "Identifier" */,-89 , 33/* "-" */,-89 , 22/* "!" */,-89 , 44/* "String" */,-89 , 45/* "Integer" */,-89 , 46/* "Boolean" */,-89 , 47/* "Float" */,-89 , 23/* "==" */,-89 , 30/* "<" */,-89 , 29/* ">" */,-89 , 27/* "<=" */,-89 , 28/* ">=" */,-89 , 24/* "!=" */,-89 , 31/* "+" */,-89 , 36/* "*" */,-89 , 35/* "/" */,-89 , 38/* ")" */,-89 , 19/* "," */,-89 , 17/* "]" */,-89 ),
	/* State 50 */ new Array( 20/* "." */,45 , 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 ),
	/* State 51 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 52 */ new Array( 4/* "WHILE" */,99 ),
	/* State 53 */ new Array( 20/* "." */,45 , 18/* ";" */,100 ),
	/* State 54 */ new Array( 18/* ";" */,-78 , 23/* "==" */,-78 , 30/* "<" */,-78 , 29/* ">" */,-78 , 27/* "<=" */,-78 , 28/* ">=" */,-78 , 24/* "!=" */,-78 , 33/* "-" */,-78 , 31/* "+" */,-78 , 20/* "." */,-78 , 8/* "RETURN" */,-78 , 42/* "Variable" */,-78 , 2/* "IF" */,-78 , 4/* "WHILE" */,-78 , 6/* "FOR" */,-78 , 5/* "DO" */,-78 , 7/* "ECHO" */,-78 , 14/* "{" */,-78 , 37/* "(" */,-78 , 9/* "NewToken" */,-78 , 48/* "Identifier" */,-78 , 32/* "++" */,-78 , 34/* "--" */,-78 , 22/* "!" */,-78 , 44/* "String" */,-78 , 45/* "Integer" */,-78 , 46/* "Boolean" */,-78 , 47/* "Float" */,-78 , 38/* ")" */,-78 , 19/* "," */,-78 , 36/* "*" */,-78 , 35/* "/" */,-78 , 17/* "]" */,-78 , 39/* "->" */,-78 ),
	/* State 55 */ new Array( 18/* ";" */,-76 , 23/* "==" */,-76 , 30/* "<" */,-76 , 29/* ">" */,-76 , 27/* "<=" */,-76 , 28/* ">=" */,-76 , 24/* "!=" */,-76 , 33/* "-" */,-76 , 31/* "+" */,-76 , 20/* "." */,-76 , 8/* "RETURN" */,-76 , 42/* "Variable" */,-76 , 2/* "IF" */,-76 , 4/* "WHILE" */,-76 , 6/* "FOR" */,-76 , 5/* "DO" */,-76 , 7/* "ECHO" */,-76 , 14/* "{" */,-76 , 37/* "(" */,-76 , 9/* "NewToken" */,-76 , 48/* "Identifier" */,-76 , 32/* "++" */,-76 , 34/* "--" */,-76 , 22/* "!" */,-76 , 44/* "String" */,-76 , 45/* "Integer" */,-76 , 46/* "Boolean" */,-76 , 47/* "Float" */,-76 , 38/* ")" */,-76 , 19/* "," */,-76 , 36/* "*" */,-76 , 35/* "/" */,-76 , 17/* "]" */,-76 , 39/* "->" */,-76 ),
	/* State 56 */ new Array( 16/* "[" */,101 , 21/* "=" */,102 , 18/* ";" */,-43 , 20/* "." */,-43 ),
	/* State 57 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 31/* "+" */,-51 , 19/* "," */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 ),
	/* State 58 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 17/* "]" */,-51 , 20/* "." */,-51 ),
	/* State 59 */ new Array( 15/* "}" */,105 , 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 60 */ new Array( 14/* "{" */,106 ),
	/* State 61 */ new Array( 42/* "Variable" */,108 , 38/* ")" */,-37 , 19/* "," */,-37 ),
	/* State 62 */ new Array( 20/* "." */,45 , 18/* ";" */,-38 ),
	/* State 63 */ new Array( 19/* "," */,-53 , 20/* "." */,-53 , 37/* "(" */,-53 , 42/* "Variable" */,-53 , 9/* "NewToken" */,-53 , 48/* "Identifier" */,-53 , 32/* "++" */,-53 , 34/* "--" */,-53 , 33/* "-" */,-53 , 22/* "!" */,-53 , 44/* "String" */,-53 , 45/* "Integer" */,-53 , 46/* "Boolean" */,-53 , 47/* "Float" */,-53 , 38/* ")" */,-53 , 39/* "->" */,-53 , 18/* ";" */,-53 , 23/* "==" */,-53 , 30/* "<" */,-53 , 29/* ">" */,-53 , 27/* "<=" */,-53 , 28/* ">=" */,-53 , 24/* "!=" */,-53 , 31/* "+" */,-53 , 36/* "*" */,-53 , 35/* "/" */,-53 , 8/* "RETURN" */,-53 , 2/* "IF" */,-53 , 4/* "WHILE" */,-53 , 6/* "FOR" */,-53 , 5/* "DO" */,-53 , 7/* "ECHO" */,-53 , 14/* "{" */,-53 , 17/* "]" */,-53 ),
	/* State 64 */ new Array( 48/* "Identifier" */,111 , 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 20/* "." */,-51 ),
	/* State 65 */ new Array( 16/* "[" */,101 , 39/* "->" */,-48 , 37/* "(" */,-48 , 18/* ";" */,-48 , 23/* "==" */,-48 , 30/* "<" */,-48 , 29/* ">" */,-48 , 27/* "<=" */,-48 , 28/* ">=" */,-48 , 24/* "!=" */,-48 , 33/* "-" */,-48 , 31/* "+" */,-48 , 36/* "*" */,-48 , 35/* "/" */,-48 , 20/* "." */,-48 , 8/* "RETURN" */,-48 , 42/* "Variable" */,-48 , 2/* "IF" */,-48 , 4/* "WHILE" */,-48 , 6/* "FOR" */,-48 , 5/* "DO" */,-48 , 7/* "ECHO" */,-48 , 14/* "{" */,-48 , 9/* "NewToken" */,-48 , 48/* "Identifier" */,-48 , 32/* "++" */,-48 , 34/* "--" */,-48 , 22/* "!" */,-48 , 44/* "String" */,-48 , 45/* "Integer" */,-48 , 46/* "Boolean" */,-48 , 47/* "Float" */,-48 , 38/* ")" */,-48 , 19/* "," */,-48 , 17/* "]" */,-48 ),
	/* State 66 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 17/* "]" */,-51 , 39/* "->" */,-51 ),
	/* State 67 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 17/* "]" */,-51 , 39/* "->" */,-51 ),
	/* State 68 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 17/* "]" */,-51 , 39/* "->" */,-51 ),
	/* State 69 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 17/* "]" */,-51 , 39/* "->" */,-51 ),
	/* State 70 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 17/* "]" */,-51 , 39/* "->" */,-51 ),
	/* State 71 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 17/* "]" */,-51 , 39/* "->" */,-51 ),
	/* State 72 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 38/* ")" */,-51 , 19/* "," */,-51 , 20/* "." */,-51 ),
	/* State 73 */ new Array( 39/* "->" */,121 , 37/* "(" */,63 ),
	/* State 74 */ new Array( 16/* "[" */,58 , 37/* "(" */,-47 , 39/* "->" */,-47 ),
	/* State 75 */ new Array( 37/* "(" */,-54 , 39/* "->" */,-54 , 18/* ";" */,-54 , 23/* "==" */,-54 , 30/* "<" */,-54 , 29/* ">" */,-54 , 27/* "<=" */,-54 , 28/* ">=" */,-54 , 24/* "!=" */,-54 , 33/* "-" */,-54 , 31/* "+" */,-54 , 36/* "*" */,-54 , 35/* "/" */,-54 , 20/* "." */,-54 , 8/* "RETURN" */,-54 , 42/* "Variable" */,-54 , 2/* "IF" */,-54 , 4/* "WHILE" */,-54 , 6/* "FOR" */,-54 , 5/* "DO" */,-54 , 7/* "ECHO" */,-54 , 14/* "{" */,-54 , 9/* "NewToken" */,-54 , 48/* "Identifier" */,-54 , 32/* "++" */,-54 , 34/* "--" */,-54 , 22/* "!" */,-54 , 44/* "String" */,-54 , 45/* "Integer" */,-54 , 46/* "Boolean" */,-54 , 47/* "Float" */,-54 , 38/* ")" */,-54 , 19/* "," */,-54 , 17/* "]" */,-54 ),
	/* State 76 */ new Array( 37/* "(" */,-55 , 39/* "->" */,-55 , 18/* ";" */,-55 , 23/* "==" */,-55 , 30/* "<" */,-55 , 29/* ">" */,-55 , 27/* "<=" */,-55 , 28/* ">=" */,-55 , 24/* "!=" */,-55 , 33/* "-" */,-55 , 31/* "+" */,-55 , 36/* "*" */,-55 , 35/* "/" */,-55 , 20/* "." */,-55 , 8/* "RETURN" */,-55 , 42/* "Variable" */,-55 , 2/* "IF" */,-55 , 4/* "WHILE" */,-55 , 6/* "FOR" */,-55 , 5/* "DO" */,-55 , 7/* "ECHO" */,-55 , 14/* "{" */,-55 , 9/* "NewToken" */,-55 , 48/* "Identifier" */,-55 , 32/* "++" */,-55 , 34/* "--" */,-55 , 22/* "!" */,-55 , 44/* "String" */,-55 , 45/* "Integer" */,-55 , 46/* "Boolean" */,-55 , 47/* "Float" */,-55 , 38/* ")" */,-55 , 19/* "," */,-55 , 17/* "]" */,-55 ),
	/* State 77 */ new Array( 37/* "(" */,-89 , 16/* "[" */,-89 , 39/* "->" */,-89 , 18/* ";" */,-89 , 23/* "==" */,-89 , 30/* "<" */,-89 , 29/* ">" */,-89 , 27/* "<=" */,-89 , 28/* ">=" */,-89 , 24/* "!=" */,-89 , 33/* "-" */,-89 , 31/* "+" */,-89 , 36/* "*" */,-89 , 35/* "/" */,-89 , 20/* "." */,-89 , 8/* "RETURN" */,-89 , 42/* "Variable" */,-89 , 2/* "IF" */,-89 , 4/* "WHILE" */,-89 , 6/* "FOR" */,-89 , 5/* "DO" */,-89 , 7/* "ECHO" */,-89 , 14/* "{" */,-89 , 9/* "NewToken" */,-89 , 48/* "Identifier" */,-89 , 32/* "++" */,-89 , 34/* "--" */,-89 , 22/* "!" */,-89 , 44/* "String" */,-89 , 45/* "Integer" */,-89 , 46/* "Boolean" */,-89 , 47/* "Float" */,-89 , 38/* ")" */,-89 , 19/* "," */,-89 , 17/* "]" */,-89 ),
	/* State 78 */ new Array( 35/* "/" */,89 , 36/* "*" */,90 , 38/* ")" */,122 , 23/* "==" */,-81 , 30/* "<" */,-81 , 29/* ">" */,-81 , 27/* "<=" */,-81 , 28/* ">=" */,-81 , 24/* "!=" */,-81 , 33/* "-" */,-81 , 31/* "+" */,-81 , 20/* "." */,-81 ),
	/* State 79 */ new Array( 31/* "+" */,84 , 33/* "-" */,85 , 38/* ")" */,123 , 23/* "==" */,-73 , 30/* "<" */,-73 , 29/* ">" */,-73 , 27/* "<=" */,-73 , 28/* ">=" */,-73 , 24/* "!=" */,-73 , 20/* "." */,-73 ),
	/* State 80 */ new Array( 24/* "!=" */,66 , 28/* ">=" */,67 , 27/* "<=" */,68 , 29/* ">" */,69 , 30/* "<" */,70 , 23/* "==" */,71 , 38/* ")" */,124 , 20/* "." */,-40 ),
	/* State 81 */ new Array( 20/* "." */,45 , 38/* ")" */,125 ),
	/* State 82 */ new Array( 19/* "," */,126 , 38/* ")" */,127 ),
	/* State 83 */ new Array( 20/* "." */,45 , 38/* ")" */,-61 , 19/* "," */,-61 ),
	/* State 84 */ new Array( 37/* "(" */,129 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 42/* "Variable" */,77 , 48/* "Identifier" */,30 ),
	/* State 85 */ new Array( 37/* "(" */,129 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 42/* "Variable" */,77 , 48/* "Identifier" */,30 ),
	/* State 86 */ new Array( 19/* "," */,-52 , 20/* "." */,-52 , 37/* "(" */,-52 , 42/* "Variable" */,-52 , 9/* "NewToken" */,-52 , 48/* "Identifier" */,-52 , 32/* "++" */,-52 , 34/* "--" */,-52 , 33/* "-" */,-52 , 22/* "!" */,-52 , 44/* "String" */,-52 , 45/* "Integer" */,-52 , 46/* "Boolean" */,-52 , 47/* "Float" */,-52 , 38/* ")" */,-52 ),
	/* State 87 */ new Array( 18/* ";" */,-77 , 23/* "==" */,-77 , 30/* "<" */,-77 , 29/* ">" */,-77 , 27/* "<=" */,-77 , 28/* ">=" */,-77 , 24/* "!=" */,-77 , 33/* "-" */,-77 , 31/* "+" */,-77 , 20/* "." */,-77 , 8/* "RETURN" */,-77 , 42/* "Variable" */,-77 , 2/* "IF" */,-77 , 4/* "WHILE" */,-77 , 6/* "FOR" */,-77 , 5/* "DO" */,-77 , 7/* "ECHO" */,-77 , 14/* "{" */,-77 , 37/* "(" */,-77 , 9/* "NewToken" */,-77 , 48/* "Identifier" */,-77 , 32/* "++" */,-77 , 34/* "--" */,-77 , 22/* "!" */,-77 , 44/* "String" */,-77 , 45/* "Integer" */,-77 , 46/* "Boolean" */,-77 , 47/* "Float" */,-77 , 38/* ")" */,-77 , 19/* "," */,-77 , 36/* "*" */,-77 , 35/* "/" */,-77 , 17/* "]" */,-77 , 39/* "->" */,-77 ),
	/* State 88 */ new Array( 18/* ";" */,-79 , 23/* "==" */,-79 , 30/* "<" */,-79 , 29/* ">" */,-79 , 27/* "<=" */,-79 , 28/* ">=" */,-79 , 24/* "!=" */,-79 , 33/* "-" */,-79 , 31/* "+" */,-79 , 20/* "." */,-79 , 8/* "RETURN" */,-79 , 42/* "Variable" */,-79 , 2/* "IF" */,-79 , 4/* "WHILE" */,-79 , 6/* "FOR" */,-79 , 5/* "DO" */,-79 , 7/* "ECHO" */,-79 , 14/* "{" */,-79 , 37/* "(" */,-79 , 9/* "NewToken" */,-79 , 48/* "Identifier" */,-79 , 32/* "++" */,-79 , 34/* "--" */,-79 , 22/* "!" */,-79 , 44/* "String" */,-79 , 45/* "Integer" */,-79 , 46/* "Boolean" */,-79 , 47/* "Float" */,-79 , 38/* ")" */,-79 , 19/* "," */,-79 , 36/* "*" */,-79 , 35/* "/" */,-79 , 17/* "]" */,-79 , 39/* "->" */,-79 ),
	/* State 89 */ new Array( 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 42/* "Variable" */,77 , 48/* "Identifier" */,30 ),
	/* State 90 */ new Array( 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 42/* "Variable" */,77 , 48/* "Identifier" */,30 ),
	/* State 91 */ new Array( 18/* ";" */,-86 , 23/* "==" */,-86 , 30/* "<" */,-86 , 29/* ">" */,-86 , 27/* "<=" */,-86 , 28/* ">=" */,-86 , 24/* "!=" */,-86 , 33/* "-" */,-86 , 31/* "+" */,-86 , 36/* "*" */,-86 , 35/* "/" */,-86 , 20/* "." */,-86 , 8/* "RETURN" */,-86 , 42/* "Variable" */,-86 , 2/* "IF" */,-86 , 4/* "WHILE" */,-86 , 6/* "FOR" */,-86 , 5/* "DO" */,-86 , 7/* "ECHO" */,-86 , 14/* "{" */,-86 , 37/* "(" */,-86 , 9/* "NewToken" */,-86 , 48/* "Identifier" */,-86 , 32/* "++" */,-86 , 34/* "--" */,-86 , 22/* "!" */,-86 , 44/* "String" */,-86 , 45/* "Integer" */,-86 , 46/* "Boolean" */,-86 , 47/* "Float" */,-86 , 38/* ")" */,-86 , 19/* "," */,-86 , 17/* "]" */,-86 , 39/* "->" */,-86 ),
	/* State 92 */ new Array( 37/* "(" */,63 , 39/* "->" */,121 , 18/* ";" */,-95 , 23/* "==" */,-95 , 30/* "<" */,-95 , 29/* ">" */,-95 , 27/* "<=" */,-95 , 28/* ">=" */,-95 , 24/* "!=" */,-95 , 33/* "-" */,-95 , 31/* "+" */,-95 , 36/* "*" */,-95 , 35/* "/" */,-95 , 20/* "." */,-95 , 8/* "RETURN" */,-95 , 42/* "Variable" */,-95 , 2/* "IF" */,-95 , 4/* "WHILE" */,-95 , 6/* "FOR" */,-95 , 5/* "DO" */,-95 , 7/* "ECHO" */,-95 , 14/* "{" */,-95 , 9/* "NewToken" */,-95 , 48/* "Identifier" */,-95 , 32/* "++" */,-95 , 34/* "--" */,-95 , 22/* "!" */,-95 , 44/* "String" */,-95 , 45/* "Integer" */,-95 , 46/* "Boolean" */,-95 , 47/* "Float" */,-95 , 38/* ")" */,-95 , 19/* "," */,-95 , 17/* "]" */,-95 ),
	/* State 93 */ new Array( 20/* "." */,45 , 18/* ";" */,-87 , 23/* "==" */,-87 , 30/* "<" */,-87 , 29/* ">" */,-87 , 27/* "<=" */,-87 , 28/* ">=" */,-87 , 24/* "!=" */,-87 , 33/* "-" */,-87 , 31/* "+" */,-87 , 36/* "*" */,-87 , 35/* "/" */,-87 , 8/* "RETURN" */,-87 , 42/* "Variable" */,-87 , 2/* "IF" */,-87 , 4/* "WHILE" */,-87 , 6/* "FOR" */,-87 , 5/* "DO" */,-87 , 7/* "ECHO" */,-87 , 14/* "{" */,-87 , 37/* "(" */,-87 , 9/* "NewToken" */,-87 , 48/* "Identifier" */,-87 , 32/* "++" */,-87 , 34/* "--" */,-87 , 22/* "!" */,-87 , 44/* "String" */,-87 , 45/* "Integer" */,-87 , 46/* "Boolean" */,-87 , 47/* "Float" */,-87 , 38/* ")" */,-87 , 19/* "," */,-87 , 17/* "]" */,-87 , 39/* "->" */,-87 ),
	/* State 94 */ new Array( 20/* "." */,45 , 18/* ";" */,-71 , 23/* "==" */,-71 , 30/* "<" */,-71 , 29/* ">" */,-71 , 27/* "<=" */,-71 , 28/* ">=" */,-71 , 24/* "!=" */,-71 , 8/* "RETURN" */,-71 , 42/* "Variable" */,-71 , 2/* "IF" */,-71 , 4/* "WHILE" */,-71 , 6/* "FOR" */,-71 , 5/* "DO" */,-71 , 7/* "ECHO" */,-71 , 14/* "{" */,-71 , 37/* "(" */,-71 , 9/* "NewToken" */,-71 , 48/* "Identifier" */,-71 , 32/* "++" */,-71 , 34/* "--" */,-71 , 33/* "-" */,-71 , 22/* "!" */,-71 , 44/* "String" */,-71 , 45/* "Integer" */,-71 , 46/* "Boolean" */,-71 , 47/* "Float" */,-71 , 38/* ")" */,-71 , 19/* "," */,-71 , 31/* "+" */,-71 , 36/* "*" */,-71 , 35/* "/" */,-71 , 17/* "]" */,-71 , 39/* "->" */,-71 ),
	/* State 95 */ new Array( 3/* "ELSE" */,133 , 77/* "$" */,-21 , 8/* "RETURN" */,-21 , 42/* "Variable" */,-21 , 18/* ";" */,-21 , 2/* "IF" */,-21 , 4/* "WHILE" */,-21 , 6/* "FOR" */,-21 , 5/* "DO" */,-21 , 7/* "ECHO" */,-21 , 14/* "{" */,-21 , 10/* "ClassToken" */,-21 , 43/* "FunctionName" */,-21 , 20/* "." */,-21 , 37/* "(" */,-21 , 9/* "NewToken" */,-21 , 48/* "Identifier" */,-21 , 32/* "++" */,-21 , 34/* "--" */,-21 , 33/* "-" */,-21 , 22/* "!" */,-21 , 44/* "String" */,-21 , 45/* "Integer" */,-21 , 46/* "Boolean" */,-21 , 47/* "Float" */,-21 , 15/* "}" */,-21 ),
	/* State 96 */ new Array( 16/* "[" */,101 , 8/* "RETURN" */,-43 , 42/* "Variable" */,-43 , 18/* ";" */,-43 , 2/* "IF" */,-43 , 4/* "WHILE" */,-43 , 6/* "FOR" */,-43 , 5/* "DO" */,-43 , 7/* "ECHO" */,-43 , 14/* "{" */,-43 , 20/* "." */,-43 , 37/* "(" */,-43 , 9/* "NewToken" */,-43 , 48/* "Identifier" */,-43 , 32/* "++" */,-43 , 34/* "--" */,-43 , 33/* "-" */,-43 , 22/* "!" */,-43 , 44/* "String" */,-43 , 45/* "Integer" */,-43 , 46/* "Boolean" */,-43 , 47/* "Float" */,-43 , 38/* ")" */,-43 , 23/* "==" */,-43 , 30/* "<" */,-43 , 29/* ">" */,-43 , 27/* "<=" */,-43 , 28/* ">=" */,-43 , 24/* "!=" */,-43 , 31/* "+" */,-43 , 19/* "," */,-43 , 36/* "*" */,-43 , 35/* "/" */,-43 , 17/* "]" */,-43 , 39/* "->" */,-43 ),
	/* State 97 */ new Array( 77/* "$" */,-23 , 8/* "RETURN" */,-23 , 42/* "Variable" */,-23 , 18/* ";" */,-23 , 2/* "IF" */,-23 , 4/* "WHILE" */,-23 , 6/* "FOR" */,-23 , 5/* "DO" */,-23 , 7/* "ECHO" */,-23 , 14/* "{" */,-23 , 10/* "ClassToken" */,-23 , 43/* "FunctionName" */,-23 , 20/* "." */,-23 , 37/* "(" */,-23 , 9/* "NewToken" */,-23 , 48/* "Identifier" */,-23 , 32/* "++" */,-23 , 34/* "--" */,-23 , 33/* "-" */,-23 , 22/* "!" */,-23 , 44/* "String" */,-23 , 45/* "Integer" */,-23 , 46/* "Boolean" */,-23 , 47/* "Float" */,-23 , 15/* "}" */,-23 , 3/* "ELSE" */,-23 ),
	/* State 98 */ new Array( 20/* "." */,45 , 18/* ";" */,134 ),
	/* State 99 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 100 */ new Array( 77/* "$" */,-26 , 8/* "RETURN" */,-26 , 42/* "Variable" */,-26 , 18/* ";" */,-26 , 2/* "IF" */,-26 , 4/* "WHILE" */,-26 , 6/* "FOR" */,-26 , 5/* "DO" */,-26 , 7/* "ECHO" */,-26 , 14/* "{" */,-26 , 10/* "ClassToken" */,-26 , 43/* "FunctionName" */,-26 , 20/* "." */,-26 , 37/* "(" */,-26 , 9/* "NewToken" */,-26 , 48/* "Identifier" */,-26 , 32/* "++" */,-26 , 34/* "--" */,-26 , 33/* "-" */,-26 , 22/* "!" */,-26 , 44/* "String" */,-26 , 45/* "Integer" */,-26 , 46/* "Boolean" */,-26 , 47/* "Float" */,-26 , 15/* "}" */,-26 , 3/* "ELSE" */,-26 ),
	/* State 101 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 17/* "]" */,-51 , 20/* "." */,-51 ),
	/* State 102 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 103 */ new Array( 20/* "." */,45 , 18/* ";" */,-33 , 8/* "RETURN" */,-33 , 42/* "Variable" */,-33 , 2/* "IF" */,-33 , 4/* "WHILE" */,-33 , 6/* "FOR" */,-33 , 5/* "DO" */,-33 , 7/* "ECHO" */,-33 , 14/* "{" */,-33 , 37/* "(" */,-33 , 9/* "NewToken" */,-33 , 48/* "Identifier" */,-33 , 32/* "++" */,-33 , 34/* "--" */,-33 , 33/* "-" */,-33 , 22/* "!" */,-33 , 44/* "String" */,-33 , 45/* "Integer" */,-33 , 46/* "Boolean" */,-33 , 47/* "Float" */,-33 , 38/* ")" */,-33 , 23/* "==" */,-33 , 30/* "<" */,-33 , 29/* ">" */,-33 , 27/* "<=" */,-33 , 28/* ">=" */,-33 , 24/* "!=" */,-33 , 31/* "+" */,-33 , 19/* "," */,-33 , 36/* "*" */,-33 , 35/* "/" */,-33 , 17/* "]" */,-33 , 39/* "->" */,-33 ),
	/* State 104 */ new Array( 20/* "." */,45 , 17/* "]" */,138 ),
	/* State 105 */ new Array( 77/* "$" */,-28 , 8/* "RETURN" */,-28 , 42/* "Variable" */,-28 , 18/* ";" */,-28 , 2/* "IF" */,-28 , 4/* "WHILE" */,-28 , 6/* "FOR" */,-28 , 5/* "DO" */,-28 , 7/* "ECHO" */,-28 , 14/* "{" */,-28 , 10/* "ClassToken" */,-28 , 43/* "FunctionName" */,-28 , 20/* "." */,-28 , 37/* "(" */,-28 , 9/* "NewToken" */,-28 , 48/* "Identifier" */,-28 , 32/* "++" */,-28 , 34/* "--" */,-28 , 33/* "-" */,-28 , 22/* "!" */,-28 , 44/* "String" */,-28 , 45/* "Integer" */,-28 , 46/* "Boolean" */,-28 , 47/* "Float" */,-28 , 15/* "}" */,-28 , 3/* "ELSE" */,-28 ),
	/* State 106 */ new Array( 15/* "}" */,-6 , 11/* "PublicToken" */,-6 , 13/* "ProtectedToken" */,-6 , 12/* "PrivateToken" */,-6 , 43/* "FunctionName" */,-6 ),
	/* State 107 */ new Array( 19/* "," */,140 , 38/* ")" */,141 ),
	/* State 108 */ new Array( 38/* ")" */,-36 , 19/* "," */,-36 ),
	/* State 109 */ new Array( 21/* "=" */,142 , 18/* ";" */,-42 , 39/* "->" */,-42 , 20/* "." */,-42 , 37/* "(" */,-42 , 23/* "==" */,-42 , 30/* "<" */,-42 , 29/* ">" */,-42 , 27/* "<=" */,-42 , 28/* ">=" */,-42 , 24/* "!=" */,-42 , 33/* "-" */,-42 , 31/* "+" */,-42 , 36/* "*" */,-42 , 35/* "/" */,-42 , 8/* "RETURN" */,-42 , 42/* "Variable" */,-42 , 2/* "IF" */,-42 , 4/* "WHILE" */,-42 , 6/* "FOR" */,-42 , 5/* "DO" */,-42 , 7/* "ECHO" */,-42 , 14/* "{" */,-42 , 9/* "NewToken" */,-42 , 48/* "Identifier" */,-42 , 32/* "++" */,-42 , 34/* "--" */,-42 , 22/* "!" */,-42 , 44/* "String" */,-42 , 45/* "Integer" */,-42 , 46/* "Boolean" */,-42 , 47/* "Float" */,-42 , 38/* ")" */,-42 , 19/* "," */,-42 , 17/* "]" */,-42 ),
	/* State 110 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 38/* ")" */,-51 , 19/* "," */,-51 , 20/* "." */,-51 ),
	/* State 111 */ new Array( 37/* "(" */,86 , 18/* ";" */,-56 , 39/* "->" */,-56 , 20/* "." */,-56 , 23/* "==" */,-56 , 30/* "<" */,-56 , 29/* ">" */,-56 , 27/* "<=" */,-56 , 28/* ">=" */,-56 , 24/* "!=" */,-56 , 33/* "-" */,-56 , 31/* "+" */,-56 , 36/* "*" */,-56 , 35/* "/" */,-56 , 8/* "RETURN" */,-56 , 42/* "Variable" */,-56 , 2/* "IF" */,-56 , 4/* "WHILE" */,-56 , 6/* "FOR" */,-56 , 5/* "DO" */,-56 , 7/* "ECHO" */,-56 , 14/* "{" */,-56 , 9/* "NewToken" */,-56 , 48/* "Identifier" */,-56 , 32/* "++" */,-56 , 34/* "--" */,-56 , 22/* "!" */,-56 , 44/* "String" */,-56 , 45/* "Integer" */,-56 , 46/* "Boolean" */,-56 , 47/* "Float" */,-56 , 38/* ")" */,-56 , 19/* "," */,-56 , 17/* "]" */,-56 , 21/* "=" */,-56 ),
	/* State 112 */ new Array( 18/* ";" */,-57 , 39/* "->" */,-57 , 20/* "." */,-49 , 37/* "(" */,-57 , 23/* "==" */,-57 , 30/* "<" */,-57 , 29/* ">" */,-57 , 27/* "<=" */,-57 , 28/* ">=" */,-57 , 24/* "!=" */,-57 , 33/* "-" */,-57 , 31/* "+" */,-57 , 36/* "*" */,-57 , 35/* "/" */,-57 , 8/* "RETURN" */,-57 , 42/* "Variable" */,-57 , 2/* "IF" */,-57 , 4/* "WHILE" */,-57 , 6/* "FOR" */,-57 , 5/* "DO" */,-57 , 7/* "ECHO" */,-57 , 14/* "{" */,-57 , 9/* "NewToken" */,-57 , 48/* "Identifier" */,-57 , 32/* "++" */,-57 , 34/* "--" */,-57 , 22/* "!" */,-57 , 44/* "String" */,-57 , 45/* "Integer" */,-57 , 46/* "Boolean" */,-57 , 47/* "Float" */,-57 , 38/* ")" */,-57 , 19/* "," */,-57 , 17/* "]" */,-57 ),
	/* State 113 */ new Array( 20/* "." */,45 ),
	/* State 114 */ new Array( 20/* "." */,45 , 18/* ";" */,-70 , 23/* "==" */,-70 , 30/* "<" */,-70 , 29/* ">" */,-70 , 27/* "<=" */,-70 , 28/* ">=" */,-70 , 24/* "!=" */,-70 , 8/* "RETURN" */,-70 , 42/* "Variable" */,-70 , 2/* "IF" */,-70 , 4/* "WHILE" */,-70 , 6/* "FOR" */,-70 , 5/* "DO" */,-70 , 7/* "ECHO" */,-70 , 14/* "{" */,-70 , 37/* "(" */,-70 , 9/* "NewToken" */,-70 , 48/* "Identifier" */,-70 , 32/* "++" */,-70 , 34/* "--" */,-70 , 33/* "-" */,-70 , 22/* "!" */,-70 , 44/* "String" */,-70 , 45/* "Integer" */,-70 , 46/* "Boolean" */,-70 , 47/* "Float" */,-70 , 38/* ")" */,-70 , 19/* "," */,-70 , 31/* "+" */,-70 , 36/* "*" */,-70 , 35/* "/" */,-70 , 17/* "]" */,-70 , 39/* "->" */,-70 ),
	/* State 115 */ new Array( 20/* "." */,45 , 18/* ";" */,-69 , 23/* "==" */,-69 , 30/* "<" */,-69 , 29/* ">" */,-69 , 27/* "<=" */,-69 , 28/* ">=" */,-69 , 24/* "!=" */,-69 , 8/* "RETURN" */,-69 , 42/* "Variable" */,-69 , 2/* "IF" */,-69 , 4/* "WHILE" */,-69 , 6/* "FOR" */,-69 , 5/* "DO" */,-69 , 7/* "ECHO" */,-69 , 14/* "{" */,-69 , 37/* "(" */,-69 , 9/* "NewToken" */,-69 , 48/* "Identifier" */,-69 , 32/* "++" */,-69 , 34/* "--" */,-69 , 33/* "-" */,-69 , 22/* "!" */,-69 , 44/* "String" */,-69 , 45/* "Integer" */,-69 , 46/* "Boolean" */,-69 , 47/* "Float" */,-69 , 38/* ")" */,-69 , 19/* "," */,-69 , 31/* "+" */,-69 , 36/* "*" */,-69 , 35/* "/" */,-69 , 17/* "]" */,-69 , 39/* "->" */,-69 ),
	/* State 116 */ new Array( 20/* "." */,45 , 18/* ";" */,-68 , 23/* "==" */,-68 , 30/* "<" */,-68 , 29/* ">" */,-68 , 27/* "<=" */,-68 , 28/* ">=" */,-68 , 24/* "!=" */,-68 , 8/* "RETURN" */,-68 , 42/* "Variable" */,-68 , 2/* "IF" */,-68 , 4/* "WHILE" */,-68 , 6/* "FOR" */,-68 , 5/* "DO" */,-68 , 7/* "ECHO" */,-68 , 14/* "{" */,-68 , 37/* "(" */,-68 , 9/* "NewToken" */,-68 , 48/* "Identifier" */,-68 , 32/* "++" */,-68 , 34/* "--" */,-68 , 33/* "-" */,-68 , 22/* "!" */,-68 , 44/* "String" */,-68 , 45/* "Integer" */,-68 , 46/* "Boolean" */,-68 , 47/* "Float" */,-68 , 38/* ")" */,-68 , 19/* "," */,-68 , 31/* "+" */,-68 , 36/* "*" */,-68 , 35/* "/" */,-68 , 17/* "]" */,-68 , 39/* "->" */,-68 ),
	/* State 117 */ new Array( 20/* "." */,45 , 18/* ";" */,-67 , 23/* "==" */,-67 , 30/* "<" */,-67 , 29/* ">" */,-67 , 27/* "<=" */,-67 , 28/* ">=" */,-67 , 24/* "!=" */,-67 , 8/* "RETURN" */,-67 , 42/* "Variable" */,-67 , 2/* "IF" */,-67 , 4/* "WHILE" */,-67 , 6/* "FOR" */,-67 , 5/* "DO" */,-67 , 7/* "ECHO" */,-67 , 14/* "{" */,-67 , 37/* "(" */,-67 , 9/* "NewToken" */,-67 , 48/* "Identifier" */,-67 , 32/* "++" */,-67 , 34/* "--" */,-67 , 33/* "-" */,-67 , 22/* "!" */,-67 , 44/* "String" */,-67 , 45/* "Integer" */,-67 , 46/* "Boolean" */,-67 , 47/* "Float" */,-67 , 38/* ")" */,-67 , 19/* "," */,-67 , 31/* "+" */,-67 , 36/* "*" */,-67 , 35/* "/" */,-67 , 17/* "]" */,-67 , 39/* "->" */,-67 ),
	/* State 118 */ new Array( 20/* "." */,45 , 18/* ";" */,-66 , 23/* "==" */,-66 , 30/* "<" */,-66 , 29/* ">" */,-66 , 27/* "<=" */,-66 , 28/* ">=" */,-66 , 24/* "!=" */,-66 , 8/* "RETURN" */,-66 , 42/* "Variable" */,-66 , 2/* "IF" */,-66 , 4/* "WHILE" */,-66 , 6/* "FOR" */,-66 , 5/* "DO" */,-66 , 7/* "ECHO" */,-66 , 14/* "{" */,-66 , 37/* "(" */,-66 , 9/* "NewToken" */,-66 , 48/* "Identifier" */,-66 , 32/* "++" */,-66 , 34/* "--" */,-66 , 33/* "-" */,-66 , 22/* "!" */,-66 , 44/* "String" */,-66 , 45/* "Integer" */,-66 , 46/* "Boolean" */,-66 , 47/* "Float" */,-66 , 38/* ")" */,-66 , 19/* "," */,-66 , 31/* "+" */,-66 , 36/* "*" */,-66 , 35/* "/" */,-66 , 17/* "]" */,-66 , 39/* "->" */,-66 ),
	/* State 119 */ new Array( 20/* "." */,45 , 18/* ";" */,-65 , 23/* "==" */,-65 , 30/* "<" */,-65 , 29/* ">" */,-65 , 27/* "<=" */,-65 , 28/* ">=" */,-65 , 24/* "!=" */,-65 , 8/* "RETURN" */,-65 , 42/* "Variable" */,-65 , 2/* "IF" */,-65 , 4/* "WHILE" */,-65 , 6/* "FOR" */,-65 , 5/* "DO" */,-65 , 7/* "ECHO" */,-65 , 14/* "{" */,-65 , 37/* "(" */,-65 , 9/* "NewToken" */,-65 , 48/* "Identifier" */,-65 , 32/* "++" */,-65 , 34/* "--" */,-65 , 33/* "-" */,-65 , 22/* "!" */,-65 , 44/* "String" */,-65 , 45/* "Integer" */,-65 , 46/* "Boolean" */,-65 , 47/* "Float" */,-65 , 38/* ")" */,-65 , 19/* "," */,-65 , 31/* "+" */,-65 , 36/* "*" */,-65 , 35/* "/" */,-65 , 17/* "]" */,-65 , 39/* "->" */,-65 ),
	/* State 120 */ new Array( 19/* "," */,126 , 38/* ")" */,144 ),
	/* State 121 */ new Array( 48/* "Identifier" */,111 , 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 20/* "." */,-51 ),
	/* State 122 */ new Array( 18/* ";" */,-84 , 23/* "==" */,-84 , 30/* "<" */,-84 , 29/* ">" */,-84 , 27/* "<=" */,-84 , 28/* ">=" */,-84 , 24/* "!=" */,-84 , 33/* "-" */,-84 , 31/* "+" */,-84 , 36/* "*" */,-84 , 35/* "/" */,-84 , 20/* "." */,-84 , 8/* "RETURN" */,-84 , 42/* "Variable" */,-84 , 2/* "IF" */,-84 , 4/* "WHILE" */,-84 , 6/* "FOR" */,-84 , 5/* "DO" */,-84 , 7/* "ECHO" */,-84 , 14/* "{" */,-84 , 37/* "(" */,-84 , 9/* "NewToken" */,-84 , 48/* "Identifier" */,-84 , 32/* "++" */,-84 , 34/* "--" */,-84 , 22/* "!" */,-84 , 44/* "String" */,-84 , 45/* "Integer" */,-84 , 46/* "Boolean" */,-84 , 47/* "Float" */,-84 , 38/* ")" */,-84 , 19/* "," */,-84 , 17/* "]" */,-84 , 39/* "->" */,-84 ),
	/* State 123 */ new Array( 18/* ";" */,-80 , 23/* "==" */,-80 , 30/* "<" */,-80 , 29/* ">" */,-80 , 27/* "<=" */,-80 , 28/* ">=" */,-80 , 24/* "!=" */,-80 , 33/* "-" */,-80 , 31/* "+" */,-80 , 20/* "." */,-80 , 8/* "RETURN" */,-80 , 42/* "Variable" */,-80 , 2/* "IF" */,-80 , 4/* "WHILE" */,-80 , 6/* "FOR" */,-80 , 5/* "DO" */,-80 , 7/* "ECHO" */,-80 , 14/* "{" */,-80 , 37/* "(" */,-80 , 9/* "NewToken" */,-80 , 48/* "Identifier" */,-80 , 32/* "++" */,-80 , 34/* "--" */,-80 , 22/* "!" */,-80 , 44/* "String" */,-80 , 45/* "Integer" */,-80 , 46/* "Boolean" */,-80 , 47/* "Float" */,-80 , 38/* ")" */,-80 , 36/* "*" */,-80 , 35/* "/" */,-80 , 19/* "," */,-80 , 17/* "]" */,-80 , 39/* "->" */,-80 ),
	/* State 124 */ new Array( 18/* ";" */,-72 , 23/* "==" */,-72 , 30/* "<" */,-72 , 29/* ">" */,-72 , 27/* "<=" */,-72 , 28/* ">=" */,-72 , 24/* "!=" */,-72 , 20/* "." */,-72 , 8/* "RETURN" */,-72 , 42/* "Variable" */,-72 , 2/* "IF" */,-72 , 4/* "WHILE" */,-72 , 6/* "FOR" */,-72 , 5/* "DO" */,-72 , 7/* "ECHO" */,-72 , 14/* "{" */,-72 , 37/* "(" */,-72 , 9/* "NewToken" */,-72 , 48/* "Identifier" */,-72 , 32/* "++" */,-72 , 34/* "--" */,-72 , 33/* "-" */,-72 , 22/* "!" */,-72 , 44/* "String" */,-72 , 45/* "Integer" */,-72 , 46/* "Boolean" */,-72 , 47/* "Float" */,-72 , 38/* ")" */,-72 , 31/* "+" */,-72 , 19/* "," */,-72 , 36/* "*" */,-72 , 35/* "/" */,-72 , 17/* "]" */,-72 , 39/* "->" */,-72 ),
	/* State 125 */ new Array( 18/* ";" */,-45 , 20/* "." */,-45 , 8/* "RETURN" */,-45 , 42/* "Variable" */,-45 , 2/* "IF" */,-45 , 4/* "WHILE" */,-45 , 6/* "FOR" */,-45 , 5/* "DO" */,-45 , 7/* "ECHO" */,-45 , 14/* "{" */,-45 , 37/* "(" */,-45 , 9/* "NewToken" */,-45 , 48/* "Identifier" */,-45 , 32/* "++" */,-45 , 34/* "--" */,-45 , 33/* "-" */,-45 , 22/* "!" */,-45 , 44/* "String" */,-45 , 45/* "Integer" */,-45 , 46/* "Boolean" */,-45 , 47/* "Float" */,-45 , 38/* ")" */,-45 , 23/* "==" */,-45 , 30/* "<" */,-45 , 29/* ">" */,-45 , 27/* "<=" */,-45 , 28/* ">=" */,-45 , 24/* "!=" */,-45 , 19/* "," */,-45 , 31/* "+" */,-45 , 36/* "*" */,-45 , 35/* "/" */,-45 , 17/* "]" */,-45 , 39/* "->" */,-45 ),
	/* State 126 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 38/* ")" */,-51 , 19/* "," */,-51 , 20/* "." */,-51 ),
	/* State 127 */ new Array( 18/* ";" */,-59 , 39/* "->" */,-59 , 20/* "." */,-59 , 37/* "(" */,-59 , 23/* "==" */,-59 , 30/* "<" */,-59 , 29/* ">" */,-59 , 27/* "<=" */,-59 , 28/* ">=" */,-59 , 24/* "!=" */,-59 , 33/* "-" */,-59 , 31/* "+" */,-59 , 36/* "*" */,-59 , 35/* "/" */,-59 , 8/* "RETURN" */,-59 , 42/* "Variable" */,-59 , 2/* "IF" */,-59 , 4/* "WHILE" */,-59 , 6/* "FOR" */,-59 , 5/* "DO" */,-59 , 7/* "ECHO" */,-59 , 14/* "{" */,-59 , 9/* "NewToken" */,-59 , 48/* "Identifier" */,-59 , 32/* "++" */,-59 , 34/* "--" */,-59 , 22/* "!" */,-59 , 44/* "String" */,-59 , 45/* "Integer" */,-59 , 46/* "Boolean" */,-59 , 47/* "Float" */,-59 , 38/* ")" */,-59 , 19/* "," */,-59 , 17/* "]" */,-59 ),
	/* State 128 */ new Array( 35/* "/" */,89 , 36/* "*" */,90 , 18/* ";" */,-75 , 23/* "==" */,-75 , 30/* "<" */,-75 , 29/* ">" */,-75 , 27/* "<=" */,-75 , 28/* ">=" */,-75 , 24/* "!=" */,-75 , 33/* "-" */,-75 , 31/* "+" */,-75 , 20/* "." */,-75 , 8/* "RETURN" */,-75 , 42/* "Variable" */,-75 , 2/* "IF" */,-75 , 4/* "WHILE" */,-75 , 6/* "FOR" */,-75 , 5/* "DO" */,-75 , 7/* "ECHO" */,-75 , 14/* "{" */,-75 , 37/* "(" */,-75 , 9/* "NewToken" */,-75 , 48/* "Identifier" */,-75 , 32/* "++" */,-75 , 34/* "--" */,-75 , 22/* "!" */,-75 , 44/* "String" */,-75 , 45/* "Integer" */,-75 , 46/* "Boolean" */,-75 , 47/* "Float" */,-75 , 38/* ")" */,-75 , 19/* "," */,-75 , 17/* "]" */,-75 , 39/* "->" */,-75 ),
	/* State 129 */ new Array( 37/* "(" */,129 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 42/* "Variable" */,77 , 48/* "Identifier" */,30 ),
	/* State 130 */ new Array( 35/* "/" */,89 , 36/* "*" */,90 , 18/* ";" */,-74 , 23/* "==" */,-74 , 30/* "<" */,-74 , 29/* ">" */,-74 , 27/* "<=" */,-74 , 28/* ">=" */,-74 , 24/* "!=" */,-74 , 33/* "-" */,-74 , 31/* "+" */,-74 , 20/* "." */,-74 , 8/* "RETURN" */,-74 , 42/* "Variable" */,-74 , 2/* "IF" */,-74 , 4/* "WHILE" */,-74 , 6/* "FOR" */,-74 , 5/* "DO" */,-74 , 7/* "ECHO" */,-74 , 14/* "{" */,-74 , 37/* "(" */,-74 , 9/* "NewToken" */,-74 , 48/* "Identifier" */,-74 , 32/* "++" */,-74 , 34/* "--" */,-74 , 22/* "!" */,-74 , 44/* "String" */,-74 , 45/* "Integer" */,-74 , 46/* "Boolean" */,-74 , 47/* "Float" */,-74 , 38/* ")" */,-74 , 19/* "," */,-74 , 17/* "]" */,-74 , 39/* "->" */,-74 ),
	/* State 131 */ new Array( 18/* ";" */,-83 , 23/* "==" */,-83 , 30/* "<" */,-83 , 29/* ">" */,-83 , 27/* "<=" */,-83 , 28/* ">=" */,-83 , 24/* "!=" */,-83 , 33/* "-" */,-83 , 31/* "+" */,-83 , 36/* "*" */,-83 , 35/* "/" */,-83 , 20/* "." */,-83 , 8/* "RETURN" */,-83 , 42/* "Variable" */,-83 , 2/* "IF" */,-83 , 4/* "WHILE" */,-83 , 6/* "FOR" */,-83 , 5/* "DO" */,-83 , 7/* "ECHO" */,-83 , 14/* "{" */,-83 , 37/* "(" */,-83 , 9/* "NewToken" */,-83 , 48/* "Identifier" */,-83 , 32/* "++" */,-83 , 34/* "--" */,-83 , 22/* "!" */,-83 , 44/* "String" */,-83 , 45/* "Integer" */,-83 , 46/* "Boolean" */,-83 , 47/* "Float" */,-83 , 38/* ")" */,-83 , 19/* "," */,-83 , 17/* "]" */,-83 , 39/* "->" */,-83 ),
	/* State 132 */ new Array( 18/* ";" */,-82 , 23/* "==" */,-82 , 30/* "<" */,-82 , 29/* ">" */,-82 , 27/* "<=" */,-82 , 28/* ">=" */,-82 , 24/* "!=" */,-82 , 33/* "-" */,-82 , 31/* "+" */,-82 , 36/* "*" */,-82 , 35/* "/" */,-82 , 20/* "." */,-82 , 8/* "RETURN" */,-82 , 42/* "Variable" */,-82 , 2/* "IF" */,-82 , 4/* "WHILE" */,-82 , 6/* "FOR" */,-82 , 5/* "DO" */,-82 , 7/* "ECHO" */,-82 , 14/* "{" */,-82 , 37/* "(" */,-82 , 9/* "NewToken" */,-82 , 48/* "Identifier" */,-82 , 32/* "++" */,-82 , 34/* "--" */,-82 , 22/* "!" */,-82 , 44/* "String" */,-82 , 45/* "Integer" */,-82 , 46/* "Boolean" */,-82 , 47/* "Float" */,-82 , 38/* ")" */,-82 , 19/* "," */,-82 , 17/* "]" */,-82 , 39/* "->" */,-82 ),
	/* State 133 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 134 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 135 */ new Array( 20/* "." */,45 , 18/* ";" */,149 ),
	/* State 136 */ new Array( 20/* "." */,45 , 17/* "]" */,150 ),
	/* State 137 */ new Array( 20/* "." */,45 , 18/* ";" */,151 ),
	/* State 138 */ new Array( 21/* "=" */,-64 , 18/* ";" */,-64 , 20/* "." */,-64 , 16/* "[" */,-64 , 39/* "->" */,-64 , 37/* "(" */,-64 , 23/* "==" */,-64 , 30/* "<" */,-64 , 29/* ">" */,-64 , 27/* "<=" */,-64 , 28/* ">=" */,-64 , 24/* "!=" */,-64 , 33/* "-" */,-64 , 31/* "+" */,-64 , 36/* "*" */,-64 , 35/* "/" */,-64 , 8/* "RETURN" */,-64 , 42/* "Variable" */,-64 , 2/* "IF" */,-64 , 4/* "WHILE" */,-64 , 6/* "FOR" */,-64 , 5/* "DO" */,-64 , 7/* "ECHO" */,-64 , 14/* "{" */,-64 , 9/* "NewToken" */,-64 , 48/* "Identifier" */,-64 , 32/* "++" */,-64 , 34/* "--" */,-64 , 22/* "!" */,-64 , 44/* "String" */,-64 , 45/* "Integer" */,-64 , 46/* "Boolean" */,-64 , 47/* "Float" */,-64 , 38/* ")" */,-64 , 19/* "," */,-64 , 17/* "]" */,-64 ),
	/* State 139 */ new Array( 15/* "}" */,154 , 11/* "PublicToken" */,157 , 13/* "ProtectedToken" */,158 , 12/* "PrivateToken" */,159 , 43/* "FunctionName" */,-11 ),
	/* State 140 */ new Array( 42/* "Variable" */,160 ),
	/* State 141 */ new Array( 14/* "{" */,161 ),
	/* State 142 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 , 8/* "RETURN" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 6/* "FOR" */,-51 , 5/* "DO" */,-51 , 7/* "ECHO" */,-51 , 14/* "{" */,-51 , 39/* "->" */,-51 , 23/* "==" */,-51 , 30/* "<" */,-51 , 29/* ">" */,-51 , 27/* "<=" */,-51 , 28/* ">=" */,-51 , 24/* "!=" */,-51 , 31/* "+" */,-51 , 36/* "*" */,-51 , 35/* "/" */,-51 , 38/* ")" */,-51 , 19/* "," */,-51 , 17/* "]" */,-51 ),
	/* State 143 */ new Array( 19/* "," */,126 , 38/* ")" */,163 ),
	/* State 144 */ new Array( 18/* ";" */,-44 , 20/* "." */,-44 , 8/* "RETURN" */,-44 , 42/* "Variable" */,-44 , 2/* "IF" */,-44 , 4/* "WHILE" */,-44 , 6/* "FOR" */,-44 , 5/* "DO" */,-44 , 7/* "ECHO" */,-44 , 14/* "{" */,-44 , 37/* "(" */,-44 , 9/* "NewToken" */,-44 , 48/* "Identifier" */,-44 , 32/* "++" */,-44 , 34/* "--" */,-44 , 33/* "-" */,-44 , 22/* "!" */,-44 , 44/* "String" */,-44 , 45/* "Integer" */,-44 , 46/* "Boolean" */,-44 , 47/* "Float" */,-44 , 38/* ")" */,-44 , 19/* "," */,-44 , 23/* "==" */,-44 , 30/* "<" */,-44 , 29/* ">" */,-44 , 27/* "<=" */,-44 , 28/* ">=" */,-44 , 24/* "!=" */,-44 , 31/* "+" */,-44 , 36/* "*" */,-44 , 35/* "/" */,-44 , 17/* "]" */,-44 , 39/* "->" */,-44 ),
	/* State 145 */ new Array( 20/* "." */,45 , 38/* ")" */,-60 , 19/* "," */,-60 ),
	/* State 146 */ new Array( 35/* "/" */,89 , 36/* "*" */,90 , 38/* ")" */,122 ),
	/* State 147 */ new Array( 77/* "$" */,-22 , 8/* "RETURN" */,-22 , 42/* "Variable" */,-22 , 18/* ";" */,-22 , 2/* "IF" */,-22 , 4/* "WHILE" */,-22 , 6/* "FOR" */,-22 , 5/* "DO" */,-22 , 7/* "ECHO" */,-22 , 14/* "{" */,-22 , 10/* "ClassToken" */,-22 , 43/* "FunctionName" */,-22 , 20/* "." */,-22 , 37/* "(" */,-22 , 9/* "NewToken" */,-22 , 48/* "Identifier" */,-22 , 32/* "++" */,-22 , 34/* "--" */,-22 , 33/* "-" */,-22 , 22/* "!" */,-22 , 44/* "String" */,-22 , 45/* "Integer" */,-22 , 46/* "Boolean" */,-22 , 47/* "Float" */,-22 , 15/* "}" */,-22 , 3/* "ELSE" */,-22 ),
	/* State 148 */ new Array( 20/* "." */,45 , 18/* ";" */,164 ),
	/* State 149 */ new Array( 77/* "$" */,-25 , 8/* "RETURN" */,-25 , 42/* "Variable" */,-25 , 18/* ";" */,-25 , 2/* "IF" */,-25 , 4/* "WHILE" */,-25 , 6/* "FOR" */,-25 , 5/* "DO" */,-25 , 7/* "ECHO" */,-25 , 14/* "{" */,-25 , 10/* "ClassToken" */,-25 , 43/* "FunctionName" */,-25 , 20/* "." */,-25 , 37/* "(" */,-25 , 9/* "NewToken" */,-25 , 48/* "Identifier" */,-25 , 32/* "++" */,-25 , 34/* "--" */,-25 , 33/* "-" */,-25 , 22/* "!" */,-25 , 44/* "String" */,-25 , 45/* "Integer" */,-25 , 46/* "Boolean" */,-25 , 47/* "Float" */,-25 , 15/* "}" */,-25 , 3/* "ELSE" */,-25 ),
	/* State 150 */ new Array( 21/* "=" */,-63 , 18/* ";" */,-63 , 20/* "." */,-63 , 16/* "[" */,-63 , 39/* "->" */,-63 , 37/* "(" */,-63 , 23/* "==" */,-63 , 30/* "<" */,-63 , 29/* ">" */,-63 , 27/* "<=" */,-63 , 28/* ">=" */,-63 , 24/* "!=" */,-63 , 33/* "-" */,-63 , 31/* "+" */,-63 , 36/* "*" */,-63 , 35/* "/" */,-63 , 8/* "RETURN" */,-63 , 42/* "Variable" */,-63 , 2/* "IF" */,-63 , 4/* "WHILE" */,-63 , 6/* "FOR" */,-63 , 5/* "DO" */,-63 , 7/* "ECHO" */,-63 , 14/* "{" */,-63 , 9/* "NewToken" */,-63 , 48/* "Identifier" */,-63 , 32/* "++" */,-63 , 34/* "--" */,-63 , 22/* "!" */,-63 , 44/* "String" */,-63 , 45/* "Integer" */,-63 , 46/* "Boolean" */,-63 , 47/* "Float" */,-63 , 38/* ")" */,-63 , 19/* "," */,-63 , 17/* "]" */,-63 ),
	/* State 151 */ new Array( 77/* "$" */,-27 , 8/* "RETURN" */,-27 , 42/* "Variable" */,-27 , 18/* ";" */,-27 , 2/* "IF" */,-27 , 4/* "WHILE" */,-27 , 6/* "FOR" */,-27 , 5/* "DO" */,-27 , 7/* "ECHO" */,-27 , 14/* "{" */,-27 , 10/* "ClassToken" */,-27 , 43/* "FunctionName" */,-27 , 20/* "." */,-27 , 37/* "(" */,-27 , 9/* "NewToken" */,-27 , 48/* "Identifier" */,-27 , 32/* "++" */,-27 , 34/* "--" */,-27 , 33/* "-" */,-27 , 22/* "!" */,-27 , 44/* "String" */,-27 , 45/* "Integer" */,-27 , 46/* "Boolean" */,-27 , 47/* "Float" */,-27 , 15/* "}" */,-27 , 3/* "ELSE" */,-27 ),
	/* State 152 */ new Array( 15/* "}" */,-5 , 11/* "PublicToken" */,-5 , 13/* "ProtectedToken" */,-5 , 12/* "PrivateToken" */,-5 , 43/* "FunctionName" */,-5 ),
	/* State 153 */ new Array( 15/* "}" */,-4 , 11/* "PublicToken" */,-4 , 13/* "ProtectedToken" */,-4 , 12/* "PrivateToken" */,-4 , 43/* "FunctionName" */,-4 ),
	/* State 154 */ new Array( 77/* "$" */,-3 , 8/* "RETURN" */,-3 , 42/* "Variable" */,-3 , 18/* ";" */,-3 , 2/* "IF" */,-3 , 4/* "WHILE" */,-3 , 6/* "FOR" */,-3 , 5/* "DO" */,-3 , 7/* "ECHO" */,-3 , 14/* "{" */,-3 , 10/* "ClassToken" */,-3 , 43/* "FunctionName" */,-3 , 20/* "." */,-3 , 37/* "(" */,-3 , 9/* "NewToken" */,-3 , 48/* "Identifier" */,-3 , 32/* "++" */,-3 , 34/* "--" */,-3 , 33/* "-" */,-3 , 22/* "!" */,-3 , 44/* "String" */,-3 , 45/* "Integer" */,-3 , 46/* "Boolean" */,-3 , 47/* "Float" */,-3 , 15/* "}" */,-3 ),
	/* State 155 */ new Array( 42/* "Variable" */,165 ),
	/* State 156 */ new Array( 43/* "FunctionName" */,166 ),
	/* State 157 */ new Array( 42/* "Variable" */,-7 , 43/* "FunctionName" */,-10 ),
	/* State 158 */ new Array( 42/* "Variable" */,-8 , 43/* "FunctionName" */,-12 ),
	/* State 159 */ new Array( 42/* "Variable" */,-9 , 43/* "FunctionName" */,-13 ),
	/* State 160 */ new Array( 38/* ")" */,-35 , 19/* "," */,-35 ),
	/* State 161 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 162 */ new Array( 20/* "." */,45 , 18/* ";" */,-34 , 8/* "RETURN" */,-34 , 42/* "Variable" */,-34 , 2/* "IF" */,-34 , 4/* "WHILE" */,-34 , 6/* "FOR" */,-34 , 5/* "DO" */,-34 , 7/* "ECHO" */,-34 , 14/* "{" */,-34 , 37/* "(" */,-34 , 9/* "NewToken" */,-34 , 48/* "Identifier" */,-34 , 32/* "++" */,-34 , 34/* "--" */,-34 , 33/* "-" */,-34 , 22/* "!" */,-34 , 44/* "String" */,-34 , 45/* "Integer" */,-34 , 46/* "Boolean" */,-34 , 47/* "Float" */,-34 , 39/* "->" */,-34 , 23/* "==" */,-34 , 30/* "<" */,-34 , 29/* ">" */,-34 , 27/* "<=" */,-34 , 28/* ">=" */,-34 , 24/* "!=" */,-34 , 31/* "+" */,-34 , 36/* "*" */,-34 , 35/* "/" */,-34 , 38/* ")" */,-34 , 19/* "," */,-34 , 17/* "]" */,-34 ),
	/* State 163 */ new Array( 18/* ";" */,-58 , 39/* "->" */,-58 , 20/* "." */,-58 , 37/* "(" */,-58 , 23/* "==" */,-58 , 30/* "<" */,-58 , 29/* ">" */,-58 , 27/* "<=" */,-58 , 28/* ">=" */,-58 , 24/* "!=" */,-58 , 33/* "-" */,-58 , 31/* "+" */,-58 , 36/* "*" */,-58 , 35/* "/" */,-58 , 8/* "RETURN" */,-58 , 42/* "Variable" */,-58 , 2/* "IF" */,-58 , 4/* "WHILE" */,-58 , 6/* "FOR" */,-58 , 5/* "DO" */,-58 , 7/* "ECHO" */,-58 , 14/* "{" */,-58 , 9/* "NewToken" */,-58 , 48/* "Identifier" */,-58 , 32/* "++" */,-58 , 34/* "--" */,-58 , 22/* "!" */,-58 , 44/* "String" */,-58 , 45/* "Integer" */,-58 , 46/* "Boolean" */,-58 , 47/* "Float" */,-58 , 38/* ")" */,-58 , 19/* "," */,-58 , 17/* "]" */,-58 , 21/* "=" */,-58 ),
	/* State 164 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 38/* ")" */,-51 , 20/* "." */,-51 ),
	/* State 165 */ new Array( 18/* ";" */,169 , 21/* "=" */,170 ),
	/* State 166 */ new Array( 37/* "(" */,171 ),
	/* State 167 */ new Array( 15/* "}" */,172 , 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 168 */ new Array( 20/* "." */,45 , 38/* ")" */,173 ),
	/* State 169 */ new Array( 15/* "}" */,-16 , 11/* "PublicToken" */,-16 , 13/* "ProtectedToken" */,-16 , 12/* "PrivateToken" */,-16 , 43/* "FunctionName" */,-16 ),
	/* State 170 */ new Array( 42/* "Variable" */,49 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 171 */ new Array( 42/* "Variable" */,108 , 38/* ")" */,-37 , 19/* "," */,-37 ),
	/* State 172 */ new Array( 77/* "$" */,-14 , 8/* "RETURN" */,-14 , 42/* "Variable" */,-14 , 18/* ";" */,-14 , 2/* "IF" */,-14 , 4/* "WHILE" */,-14 , 6/* "FOR" */,-14 , 5/* "DO" */,-14 , 7/* "ECHO" */,-14 , 14/* "{" */,-14 , 10/* "ClassToken" */,-14 , 43/* "FunctionName" */,-14 , 20/* "." */,-14 , 37/* "(" */,-14 , 9/* "NewToken" */,-14 , 48/* "Identifier" */,-14 , 32/* "++" */,-14 , 34/* "--" */,-14 , 33/* "-" */,-14 , 22/* "!" */,-14 , 44/* "String" */,-14 , 45/* "Integer" */,-14 , 46/* "Boolean" */,-14 , 47/* "Float" */,-14 , 15/* "}" */,-14 ),
	/* State 173 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 174 */ new Array( 20/* "." */,45 , 18/* ";" */,177 ),
	/* State 175 */ new Array( 19/* "," */,140 , 38/* ")" */,178 ),
	/* State 176 */ new Array( 77/* "$" */,-24 , 8/* "RETURN" */,-24 , 42/* "Variable" */,-24 , 18/* ";" */,-24 , 2/* "IF" */,-24 , 4/* "WHILE" */,-24 , 6/* "FOR" */,-24 , 5/* "DO" */,-24 , 7/* "ECHO" */,-24 , 14/* "{" */,-24 , 10/* "ClassToken" */,-24 , 43/* "FunctionName" */,-24 , 20/* "." */,-24 , 37/* "(" */,-24 , 9/* "NewToken" */,-24 , 48/* "Identifier" */,-24 , 32/* "++" */,-24 , 34/* "--" */,-24 , 33/* "-" */,-24 , 22/* "!" */,-24 , 44/* "String" */,-24 , 45/* "Integer" */,-24 , 46/* "Boolean" */,-24 , 47/* "Float" */,-24 , 15/* "}" */,-24 , 3/* "ELSE" */,-24 ),
	/* State 177 */ new Array( 15/* "}" */,-17 , 11/* "PublicToken" */,-17 , 13/* "ProtectedToken" */,-17 , 12/* "PrivateToken" */,-17 , 43/* "FunctionName" */,-17 ),
	/* State 178 */ new Array( 14/* "{" */,179 ),
	/* State 179 */ new Array( 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 180 */ new Array( 15/* "}" */,181 , 2/* "IF" */,9 , 4/* "WHILE" */,10 , 6/* "FOR" */,11 , 5/* "DO" */,12 , 7/* "ECHO" */,13 , 42/* "Variable" */,14 , 14/* "{" */,15 , 10/* "ClassToken" */,16 , 43/* "FunctionName" */,17 , 8/* "RETURN" */,18 , 9/* "NewToken" */,26 , 37/* "(" */,27 , 48/* "Identifier" */,30 , 32/* "++" */,31 , 34/* "--" */,32 , 33/* "-" */,35 , 22/* "!" */,36 , 44/* "String" */,38 , 45/* "Integer" */,39 , 46/* "Boolean" */,40 , 47/* "Float" */,41 , 18/* ";" */,-51 , 20/* "." */,-51 ),
	/* State 181 */ new Array( 15/* "}" */,-15 , 11/* "PublicToken" */,-15 , 13/* "ProtectedToken" */,-15 , 12/* "PrivateToken" */,-15 , 43/* "FunctionName" */,-15 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 49/* PHPScript */,1 ),
	/* State 1 */ new Array( 50/* Stmt */,2 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 2 */ new Array( 50/* Stmt */,42 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 3 */ new Array(  ),
	/* State 4 */ new Array(  ),
	/* State 5 */ new Array(  ),
	/* State 6 */ new Array(  ),
	/* State 7 */ new Array(  ),
	/* State 8 */ new Array(  ),
	/* State 9 */ new Array( 59/* Expression */,47 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 10 */ new Array( 59/* Expression */,50 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 11 */ new Array(  ),
	/* State 12 */ new Array( 62/* SingleStmt */,52 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 13 */ new Array( 59/* Expression */,53 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 14 */ new Array( 63/* ArrayIndices */,56 ),
	/* State 15 */ new Array( 50/* Stmt */,59 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 16 */ new Array(  ),
	/* State 17 */ new Array(  ),
	/* State 18 */ new Array( 59/* Expression */,62 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 19 */ new Array(  ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array(  ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array( 63/* ArrayIndices */,65 ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array(  ),
	/* State 26 */ new Array( 67/* FunctionInvoke */,72 , 64/* LValue */,73 , 70/* MemberAccess */,22 , 71/* VarVal */,74 , 72/* FunctionAccess */,75 , 65/* AttributeAccess */,76 ),
	/* State 27 */ new Array( 74/* MulDivExp */,78 , 73/* AddSubExp */,79 , 66/* BinaryExp */,80 , 59/* Expression */,81 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 75/* UnaryExp */,34 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 76/* Value */,37 , 70/* MemberAccess */,22 , 71/* VarVal */,23 ),
	/* State 28 */ new Array( 68/* ActualParameterList */,82 , 59/* Expression */,83 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 29 */ new Array(  ),
	/* State 30 */ new Array(  ),
	/* State 31 */ new Array(  ),
	/* State 32 */ new Array(  ),
	/* State 33 */ new Array(  ),
	/* State 34 */ new Array(  ),
	/* State 35 */ new Array( 76/* Value */,91 , 71/* VarVal */,23 , 64/* LValue */,92 , 70/* MemberAccess */,22 , 72/* FunctionAccess */,75 , 65/* AttributeAccess */,76 , 67/* FunctionInvoke */,28 ),
	/* State 36 */ new Array( 59/* Expression */,93 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 37 */ new Array(  ),
	/* State 38 */ new Array(  ),
	/* State 39 */ new Array(  ),
	/* State 40 */ new Array(  ),
	/* State 41 */ new Array(  ),
	/* State 42 */ new Array( 50/* Stmt */,42 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 43 */ new Array(  ),
	/* State 44 */ new Array(  ),
	/* State 45 */ new Array( 59/* Expression */,94 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 46 */ new Array(  ),
	/* State 47 */ new Array( 62/* SingleStmt */,95 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 48 */ new Array(  ),
	/* State 49 */ new Array( 63/* ArrayIndices */,96 ),
	/* State 50 */ new Array( 62/* SingleStmt */,97 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 51 */ new Array( 59/* Expression */,98 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 52 */ new Array(  ),
	/* State 53 */ new Array(  ),
	/* State 54 */ new Array(  ),
	/* State 55 */ new Array(  ),
	/* State 56 */ new Array(  ),
	/* State 57 */ new Array( 59/* Expression */,103 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 58 */ new Array( 59/* Expression */,104 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 59 */ new Array( 50/* Stmt */,42 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 60 */ new Array(  ),
	/* State 61 */ new Array( 57/* FormalParameterList */,107 ),
	/* State 62 */ new Array(  ),
	/* State 63 */ new Array(  ),
	/* State 64 */ new Array( 65/* AttributeAccess */,109 , 67/* FunctionInvoke */,110 , 69/* ExpressionNotFunAccess */,112 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 64/* LValue */,19 , 59/* Expression */,113 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 72/* FunctionAccess */,21 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 65 */ new Array(  ),
	/* State 66 */ new Array( 59/* Expression */,114 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 67 */ new Array( 59/* Expression */,115 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 68 */ new Array( 59/* Expression */,116 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 69 */ new Array( 59/* Expression */,117 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 70 */ new Array( 59/* Expression */,118 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 71 */ new Array( 59/* Expression */,119 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 72 */ new Array( 68/* ActualParameterList */,120 , 59/* Expression */,83 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 73 */ new Array(  ),
	/* State 74 */ new Array( 63/* ArrayIndices */,65 ),
	/* State 75 */ new Array(  ),
	/* State 76 */ new Array(  ),
	/* State 77 */ new Array(  ),
	/* State 78 */ new Array(  ),
	/* State 79 */ new Array(  ),
	/* State 80 */ new Array(  ),
	/* State 81 */ new Array(  ),
	/* State 82 */ new Array(  ),
	/* State 83 */ new Array(  ),
	/* State 84 */ new Array( 74/* MulDivExp */,128 , 75/* UnaryExp */,34 , 76/* Value */,37 , 71/* VarVal */,23 , 64/* LValue */,92 , 70/* MemberAccess */,22 , 72/* FunctionAccess */,75 , 65/* AttributeAccess */,76 , 67/* FunctionInvoke */,28 ),
	/* State 85 */ new Array( 74/* MulDivExp */,130 , 75/* UnaryExp */,34 , 76/* Value */,37 , 71/* VarVal */,23 , 64/* LValue */,92 , 70/* MemberAccess */,22 , 72/* FunctionAccess */,75 , 65/* AttributeAccess */,76 , 67/* FunctionInvoke */,28 ),
	/* State 86 */ new Array(  ),
	/* State 87 */ new Array(  ),
	/* State 88 */ new Array(  ),
	/* State 89 */ new Array( 75/* UnaryExp */,131 , 76/* Value */,37 , 71/* VarVal */,23 , 64/* LValue */,92 , 70/* MemberAccess */,22 , 72/* FunctionAccess */,75 , 65/* AttributeAccess */,76 , 67/* FunctionInvoke */,28 ),
	/* State 90 */ new Array( 75/* UnaryExp */,132 , 76/* Value */,37 , 71/* VarVal */,23 , 64/* LValue */,92 , 70/* MemberAccess */,22 , 72/* FunctionAccess */,75 , 65/* AttributeAccess */,76 , 67/* FunctionInvoke */,28 ),
	/* State 91 */ new Array(  ),
	/* State 92 */ new Array(  ),
	/* State 93 */ new Array(  ),
	/* State 94 */ new Array(  ),
	/* State 95 */ new Array(  ),
	/* State 96 */ new Array(  ),
	/* State 97 */ new Array(  ),
	/* State 98 */ new Array(  ),
	/* State 99 */ new Array( 59/* Expression */,135 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 100 */ new Array(  ),
	/* State 101 */ new Array( 59/* Expression */,136 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 102 */ new Array( 59/* Expression */,137 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 103 */ new Array(  ),
	/* State 104 */ new Array(  ),
	/* State 105 */ new Array(  ),
	/* State 106 */ new Array( 51/* Member */,139 ),
	/* State 107 */ new Array(  ),
	/* State 108 */ new Array(  ),
	/* State 109 */ new Array(  ),
	/* State 110 */ new Array( 68/* ActualParameterList */,143 , 59/* Expression */,83 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 111 */ new Array(  ),
	/* State 112 */ new Array(  ),
	/* State 113 */ new Array(  ),
	/* State 114 */ new Array(  ),
	/* State 115 */ new Array(  ),
	/* State 116 */ new Array(  ),
	/* State 117 */ new Array(  ),
	/* State 118 */ new Array(  ),
	/* State 119 */ new Array(  ),
	/* State 120 */ new Array(  ),
	/* State 121 */ new Array( 67/* FunctionInvoke */,110 , 69/* ExpressionNotFunAccess */,112 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 59/* Expression */,113 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 72/* FunctionAccess */,21 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 122 */ new Array(  ),
	/* State 123 */ new Array(  ),
	/* State 124 */ new Array(  ),
	/* State 125 */ new Array(  ),
	/* State 126 */ new Array( 59/* Expression */,145 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 127 */ new Array(  ),
	/* State 128 */ new Array(  ),
	/* State 129 */ new Array( 74/* MulDivExp */,146 , 75/* UnaryExp */,34 , 76/* Value */,37 , 71/* VarVal */,23 , 64/* LValue */,92 , 70/* MemberAccess */,22 , 72/* FunctionAccess */,75 , 65/* AttributeAccess */,76 , 67/* FunctionInvoke */,28 ),
	/* State 130 */ new Array(  ),
	/* State 131 */ new Array(  ),
	/* State 132 */ new Array(  ),
	/* State 133 */ new Array( 62/* SingleStmt */,147 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 134 */ new Array( 59/* Expression */,148 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 135 */ new Array(  ),
	/* State 136 */ new Array(  ),
	/* State 137 */ new Array(  ),
	/* State 138 */ new Array(  ),
	/* State 139 */ new Array( 54/* ClassFunctionDefinition */,152 , 53/* AttributeDefinition */,153 , 55/* AttributeMod */,155 , 56/* FunctionMod */,156 ),
	/* State 140 */ new Array(  ),
	/* State 141 */ new Array(  ),
	/* State 142 */ new Array( 59/* Expression */,162 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 143 */ new Array(  ),
	/* State 144 */ new Array(  ),
	/* State 145 */ new Array(  ),
	/* State 146 */ new Array(  ),
	/* State 147 */ new Array(  ),
	/* State 148 */ new Array(  ),
	/* State 149 */ new Array(  ),
	/* State 150 */ new Array(  ),
	/* State 151 */ new Array(  ),
	/* State 152 */ new Array(  ),
	/* State 153 */ new Array(  ),
	/* State 154 */ new Array(  ),
	/* State 155 */ new Array(  ),
	/* State 156 */ new Array(  ),
	/* State 157 */ new Array(  ),
	/* State 158 */ new Array(  ),
	/* State 159 */ new Array(  ),
	/* State 160 */ new Array(  ),
	/* State 161 */ new Array( 50/* Stmt */,167 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 162 */ new Array(  ),
	/* State 163 */ new Array(  ),
	/* State 164 */ new Array( 59/* Expression */,168 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 165 */ new Array(  ),
	/* State 166 */ new Array(  ),
	/* State 167 */ new Array( 50/* Stmt */,42 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 168 */ new Array(  ),
	/* State 169 */ new Array(  ),
	/* State 170 */ new Array( 59/* Expression */,174 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 66/* BinaryExp */,24 , 61/* AssignmentStmt */,48 , 65/* AttributeAccess */,25 , 64/* LValue */,19 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 171 */ new Array( 57/* FormalParameterList */,175 ),
	/* State 172 */ new Array(  ),
	/* State 173 */ new Array( 62/* SingleStmt */,176 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 174 */ new Array(  ),
	/* State 175 */ new Array(  ),
	/* State 176 */ new Array(  ),
	/* State 177 */ new Array(  ),
	/* State 178 */ new Array(  ),
	/* State 179 */ new Array( 50/* Stmt */,180 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 180 */ new Array( 50/* Stmt */,42 , 62/* SingleStmt */,3 , 52/* ClassDefinition */,4 , 58/* FunctionDefinition */,5 , 60/* Return */,6 , 61/* AssignmentStmt */,7 , 59/* Expression */,8 , 64/* LValue */,19 , 69/* ExpressionNotFunAccess */,20 , 72/* FunctionAccess */,21 , 70/* MemberAccess */,22 , 71/* VarVal */,23 , 66/* BinaryExp */,24 , 65/* AttributeAccess */,25 , 67/* FunctionInvoke */,28 , 73/* AddSubExp */,29 , 74/* MulDivExp */,33 , 75/* UnaryExp */,34 , 76/* Value */,37 ),
	/* State 181 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"PHPScript'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"IF" /* Terminal symbol */,
	"ELSE" /* Terminal symbol */,
	"WHILE" /* Terminal symbol */,
	"DO" /* Terminal symbol */,
	"FOR" /* Terminal symbol */,
	"ECHO" /* Terminal symbol */,
	"RETURN" /* Terminal symbol */,
	"NewToken" /* Terminal symbol */,
	"ClassToken" /* Terminal symbol */,
	"PublicToken" /* Terminal symbol */,
	"PrivateToken" /* Terminal symbol */,
	"ProtectedToken" /* Terminal symbol */,
	"{" /* Terminal symbol */,
	"}" /* Terminal symbol */,
	"[" /* Terminal symbol */,
	"]" /* Terminal symbol */,
	";" /* Terminal symbol */,
	"," /* Terminal symbol */,
	"." /* Terminal symbol */,
	"=" /* Terminal symbol */,
	"!" /* Terminal symbol */,
	"==" /* Terminal symbol */,
	"!=" /* Terminal symbol */,
	"<!" /* Terminal symbol */,
	"!>" /* Terminal symbol */,
	"<=" /* Terminal symbol */,
	">=" /* Terminal symbol */,
	">" /* Terminal symbol */,
	"<" /* Terminal symbol */,
	"+" /* Terminal symbol */,
	"++" /* Terminal symbol */,
	"-" /* Terminal symbol */,
	"--" /* Terminal symbol */,
	"/" /* Terminal symbol */,
	"*" /* Terminal symbol */,
	"(" /* Terminal symbol */,
	")" /* Terminal symbol */,
	"->" /* Terminal symbol */,
	"::" /* Terminal symbol */,
	"//" /* Terminal symbol */,
	"Variable" /* Terminal symbol */,
	"FunctionName" /* Terminal symbol */,
	"String" /* Terminal symbol */,
	"Integer" /* Terminal symbol */,
	"Boolean" /* Terminal symbol */,
	"Float" /* Terminal symbol */,
	"Identifier" /* Terminal symbol */,
	"PHPScript" /* Non-terminal symbol */,
	"Stmt" /* Non-terminal symbol */,
	"Member" /* Non-terminal symbol */,
	"ClassDefinition" /* Non-terminal symbol */,
	"AttributeDefinition" /* Non-terminal symbol */,
	"ClassFunctionDefinition" /* Non-terminal symbol */,
	"AttributeMod" /* Non-terminal symbol */,
	"FunctionMod" /* Non-terminal symbol */,
	"FormalParameterList" /* Non-terminal symbol */,
	"FunctionDefinition" /* Non-terminal symbol */,
	"Expression" /* Non-terminal symbol */,
	"Return" /* Non-terminal symbol */,
	"AssignmentStmt" /* Non-terminal symbol */,
	"SingleStmt" /* Non-terminal symbol */,
	"ArrayIndices" /* Non-terminal symbol */,
	"LValue" /* Non-terminal symbol */,
	"AttributeAccess" /* Non-terminal symbol */,
	"BinaryExp" /* Non-terminal symbol */,
	"FunctionInvoke" /* Non-terminal symbol */,
	"ActualParameterList" /* Non-terminal symbol */,
	"ExpressionNotFunAccess" /* Non-terminal symbol */,
	"MemberAccess" /* Non-terminal symbol */,
	"VarVal" /* Non-terminal symbol */,
	"FunctionAccess" /* Non-terminal symbol */,
	"AddSubExp" /* Non-terminal symbol */,
	"MulDivExp" /* Non-terminal symbol */,
	"UnaryExp" /* Non-terminal symbol */,
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
	
	la = __PHPlex( info );

	while( true )
	{
		act = 183;
		for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
		{
			if( act_tab[sstack[sstack.length-1]][i] == la )
			{
				act = act_tab[sstack[sstack.length-1]][i+1];
				break;
			}
		}

		if( PHP_dbg_withtrace && sstack.length > 0 )
		{
			__PHPdbg_print( "\nState " + sstack[sstack.length-1] + "\n" +
							"\tLookahead: " + labels[la] + " (\"" + info.att + "\")\n" +
							"\tAction: " + act + "\n" + 
							"\tSource: \"" + info.src.substr( info.offset, 30 ) + ( ( info.offset + 30 < info.src.length ) ?
									"..." : "" ) + "\"\n" +
							"\tStack: " + sstack.join() + "\n" +
							"\tValue stack: " + vstack.join() + "\n" );
		}
		
			
		//Panic-mode: Try recovery when parse-error occurs!
		if( act == 183 )
		{
			if( PHP_dbg_withtrace )
				__PHPdbg_print( "Error detected: There is no reduce or shift on the symbol " + labels[la] );
			
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
			
			while( act == 183 && la != 77 )
			{
				if( PHP_dbg_withtrace )
					__PHPdbg_print( "\tError recovery\n" +
									"Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
									"Action: " + act + "\n\n" );
				if( la == -1 )
					info.offset++;
					
				while( act == 183 && sstack.length > 0 )
				{
					sstack.pop();
					vstack.pop();
					
					if( sstack.length == 0 )
						break;
						
					act = 183;
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == la )
						{
							act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
				}
				
				if( act != 183 )
					break;
				
				for( var i = 0; i < rsstack.length; i++ )
				{
					sstack.push( rsstack[i] );
					vstack.push( rvstack[i] );
				}
				
				la = __PHPlex( info );
			}
			
			if( act == 183 )
			{
				if( PHP_dbg_withtrace )
					__PHPdbg_print( "\tError recovery failed, terminating parse process..." );
				break;
			}


			if( PHP_dbg_withtrace )
				__PHPdbg_print( "\tError recovery succeeded, continuing" );
		}
		
		/*
		if( act == 183 )
			break;
		*/
		
		
		//Shift
		if( act > 0 )
		{			
			if( PHP_dbg_withtrace )
				__PHPdbg_print( "Shifting symbol: " + labels[la] + " (" + info.att + ")" );
		
			sstack.push( act );
			vstack.push( info.att );
			
			la = __PHPlex( info );
			
			if( PHP_dbg_withtrace )
				__PHPdbg_print( "\tNew lookahead symbol: " + labels[la] + " (" + info.att + ")" );
		}
		//Reduce
		else
		{		
			act *= -1;
			
			if( PHP_dbg_withtrace )
				__PHPdbg_print( "Reducing by producution: " + act );
			
			rval = void(0);
			
			if( PHP_dbg_withtrace )
				__PHPdbg_print( "\tPerforming semantic action..." );
			
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
			
											pstate.curClass = vstack[ vstack.length - 4 ]+'::';
											pstate.classTable[vstack[ vstack.length - 4 ]] =
												createClass( MOD_PUBLIC, vstack[ vstack.length - 4 ], pstate.curAttrs, pstate.curFuns );
											pstate.curAttrs = [];
											pstate.curFuns = [];
											pstate.curClass = '';
										
	}
	break;
	case 4:
	{
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 5:
	{
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 6:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 7:
	{
		 rval = MOD_PUBLIC; 
	}
	break;
	case 8:
	{
		 rval = MOD_PROTECTED; 
	}
	break;
	case 9:
	{
		 rval = MOD_PRIVATE; 
	}
	break;
	case 10:
	{
		 rval = MOD_PUBLIC; 
	}
	break;
	case 11:
	{
		 rval = MOD_PUBLIC; 
	}
	break;
	case 12:
	{
		 rval = MOD_PROTECTED; 
	}
	break;
	case 13:
	{
		 rval = MOD_PRIVATE; 
	}
	break;
	case 14:
	{
		 	
											// Check that the function is not defined twice.
											if (pstate.funTable[vstack[ vstack.length - 7 ]]) {
												throw funRedeclare(vstack[ vstack.length - 7 ]);
											}
											pstate.funTable[vstack[ vstack.length - 7 ]] =
												createFunction( vstack[ vstack.length - 7 ], pstate.curParams, vstack[ vstack.length - 2 ] );
											// Make sure to clean up param list
											// for next function declaration
											pstate.curParams = [];
										
	}
	break;
	case 15:
	{
		 	
											// Check that the function is not defined twice within
											// the same object
											if (pstate.curClass && pstate.curFuns[pstate.curClass+vstack[ vstack.length - 7 ]]) {
												throw funRedeclare(pstate.curClass+vstack[ vstack.length - 7 ]);
											}
											var fun = createFunction( vstack[ vstack.length - 7 ], pstate.curParams, vstack[ vstack.length - 2 ] );
											pstate.curFuns[vstack[ vstack.length - 7 ]] = createMember( vstack[ vstack.length - 8 ], fun );
											// Make sure to clean up param list
											// for next function declaration
											pstate.curParams = [];
										
	}
	break;
	case 16:
	{
		
											pstate.curAttrs[vstack[ vstack.length - 2 ]] = createMember( vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] );
										
	}
	break;
	case 17:
	{
		
											pstate.curAttrs[vstack[ vstack.length - 4 ]] = createMember( vstack[ vstack.length - 5 ], vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] );
										
	}
	break;
	case 18:
	{
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 19:
	{
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 20:
	{
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 21:
	{
		 rval = createNode( NODE_OP, OP_IF, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 22:
	{
		 rval = createNode( NODE_OP, OP_IF_ELSE, vstack[ vstack.length - 4 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 23:
	{
		 rval = createNode( NODE_OP, OP_WHILE_DO, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 24:
	{
		 rval = createNode( NODE_OP, OP_FOR, vstack[ vstack.length - 7 ], vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 25:
	{
		 rval = createNode( NODE_OP, OP_DO_WHILE, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 26:
	{
		 rval = createNode( NODE_OP, OP_ECHO, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 27:
	{
		 rval = createNode( NODE_OP, OP_ASSIGN_ARR, vstack[ vstack.length - 5 ], vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 28:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 29:
	{
		 rval = createNode ( NODE_OP, OP_NONE, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 30:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 31:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 32:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 33:
	{
		 rval = createNode( NODE_OP, OP_ASSIGN, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 34:
	{
		 rval = createNode( NODE_OP, OP_ATTR_ASSIGN, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 35:
	{
		
											pstate.curParams.push(
												createNode( NODE_CONST, vstack[ vstack.length - 1 ] ));
										
	}
	break;
	case 36:
	{
		
											pstate.curParams.push(
												createNode( NODE_CONST, vstack[ vstack.length - 1 ] ));
										
	}
	break;
	case 37:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 38:
	{
		
											// Create with dummy none node afterwards, so execution
											// will not halt valid sequence.
											rval = createNode( NODE_OP, OP_NONE,
													createNode( NODE_OP, OP_RETURN, vstack[ vstack.length - 1 ] ),
													createNode(NODE_OP, OP_NONE));
										
	}
	break;
	case 39:
	{
		
											// Create with dummy none node afterwards, so execution
											// will not halt valid sequence.
											rval = createNode( NODE_OP, OP_NONE,
													createNode( NODE_OP, OP_RETURN ),
													createNode(NODE_OP, OP_NONE));
										
	}
	break;
	case 40:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 41:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 42:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 43:
	{
		 rval = createNode( NODE_OP, OP_FETCH_ARR, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 44:
	{
		 rval = createNode( NODE_OP, OP_OBJ_NEW, vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 45:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 46:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 47:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 48:
	{
		 rval = createNode( NODE_OP, OP_FETCH_ARR, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 49:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 50:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 51:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 52:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 53:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 54:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 55:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 56:
	{
		 rval = createNode( NODE_OP, OP_OBJ_FETCH, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 57:
	{
		 rval = createNode( NODE_OP, OP_OBJ_FETCH, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 58:
	{
		 rval = createNode( NODE_OP, OP_OBJ_FCALL, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 59:
	{
		 rval = createNode( NODE_OP, OP_FCALL, vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 60:
	{
		 rval = createNode( NODE_OP, OP_PASS_PARAM, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 61:
	{
		 rval = createNode( NODE_OP, OP_PASS_PARAM, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 62:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 63:
	{
		 rval = createNode( NODE_OP, OP_ARR_KEYS_R, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 64:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 65:
	{
		 rval = createNode( NODE_OP, OP_EQU, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 66:
	{
		 rval = createNode( NODE_OP, OP_LOT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 67:
	{
		 rval = createNode( NODE_OP, OP_GRT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 68:
	{
		 rval = createNode( NODE_OP, OP_LOE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 69:
	{
		 rval = createNode( NODE_OP, OP_GRE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 70:
	{
		 rval = createNode( NODE_OP, OP_NEQ, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 71:
	{
		 rval = createNode( NODE_OP, OP_CONCAT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 72:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 73:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 74:
	{
		 rval = createNode( NODE_OP, OP_SUB, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 75:
	{
		 rval = createNode( NODE_OP, OP_ADD, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 76:
	{
		 rval = createNode( NODE_OP, OP_INCR_PRE, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 77:
	{
		 rval = createNode( NODE_OP, OP_INCR_POST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 78:
	{
		 rval = createNode( NODE_OP, OP_DECR_PRE, vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 79:
	{
		 rval = createNode( NODE_OP, OP_DECR_POST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 80:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 81:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 82:
	{
		 rval = createNode( NODE_OP, OP_MUL, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 83:
	{
		 rval = createNode( NODE_OP, OP_DIV, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 84:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 85:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 86:
	{
		 rval = createNode( NODE_OP, OP_NEG, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 87:
	{
		 rval = createNode( NODE_OP, OP_BOOL_NEG, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 88:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 89:
	{
		 rval = createNode( NODE_VAR, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 90:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 91:
	{
		 rval = createNode( NODE_CONST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 92:
	{
		 rval = createNode( NODE_INT, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 93:
	{
		 rval = createNode( NODE_INT, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 94:
	{
		 rval = createNode( NODE_FLOAT, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 95:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
}



			if( PHP_dbg_withtrace )
				__PHPdbg_print( "\tPopping " + pop_tab[act][1] + " off the stack..." );
				
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
				
			if( PHP_dbg_withtrace )
				__PHPdbg_print( "\tPushing non-terminal " + labels[ pop_tab[act][0] ] );
				
			sstack.push( go );
			vstack.push( rval );			
		}
		
		if( PHP_dbg_withtrace )
		{		
			alert( PHP_dbg_string );
			PHP_dbg_string = new String();
		}
	}

	if( PHP_dbg_withtrace )
	{
		__PHPdbg_print( "\nParse complete." );
		alert( PHP_dbg_string );
	}
	
	return err_cnt;
}



	var phypeOut = console.log;
	function preParse(str) {
		return str;
		var firstPhp = str.indexOf('<?');
		var res = '';
		if (firstPhp > 0 || firstPhp == -1) {
			if (firstPhp == -1) firstPhp = str.length;
			var echoStr = '<? ';
			echoStr += "echo '"+str.substring(0,firstPhp).replace("'","\'")+"';";
			echoStr += ' ?>';
			res = echoStr+str.substring(firstPhp,str.length);
		} else {
			res = str;
		}
		return res
	}
	function interpret(str) {
		var error_cnt 	= 0;
		var error_off	= new Array();
		var error_la	= new Array();
	
		if( ( error_cnt = __PHPparse( preParse(str), error_off, error_la ) ) > 0 ) {
			for(var i=0; i<error_cnt; i++)
				phypeOut( "Parse error near >" 
					+ str.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"<br/>\n" );
		}
	}
	if(process.argv.length == 3) {
		var str = require("fs").readFileSync( process.argv[2] ).toString("utf-8");
		interpret(str);
	} else {
		console.log( 'usage: proram <filename>' );
	}

