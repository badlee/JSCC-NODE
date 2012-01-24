
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
}

function newPhypeArr() {
	return clone(phypeArrayObject);
}

// Constants used for keeping track of states and variables.
var cons = {
	global : '.global',
	objGlobal : '.objGlobal',
	val : '.val#',
	arr : '.arr#',
	obj : '.obj#',
	unset : '.uns#'
}

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
}

var origState = clone(pstate);

function resetState() {
	pstate = clone(origState);
}


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
		
		pstate.symTables[scope][varName] = prefix+scope+'#'+varName

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
}


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
			var r = pstate.symTables['.global'][obj.objListEntry+'::'+vName]
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
}



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
var OP_NEW_ARR	= 17;

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
ops[OP_NEW_ARR] = function(node) {
	return createValue( T_ARRAY, {} );;
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
},

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
			return 79;

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
		else if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 77 ) || info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 81 || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 109 ) || info.src.charCodeAt( pos ) == 111 || info.src.charCodeAt( pos ) == 113 || info.src.charCodeAt( pos ) == 115 || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 91 ) state = 17;
		else if( info.src.charCodeAt( pos ) == 93 ) state = 18;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 19;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 20;
		else if( info.src.charCodeAt( pos ) == 34 ) state = 48;
		else if( info.src.charCodeAt( pos ) == 55 ) state = 49;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 36 ) state = 52;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 53;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 54;
		else if( info.src.charCodeAt( pos ) == 58 ) state = 56;
		else if( info.src.charCodeAt( pos ) == 63 ) state = 58;
		else if( info.src.charCodeAt( pos ) == 92 ) state = 60;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 90;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 103;
		else if( info.src.charCodeAt( pos ) == 116 ) state = 104;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 113;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 114;
		else if( info.src.charCodeAt( pos ) == 102 ) state = 115;
		else if( info.src.charCodeAt( pos ) == 80 || info.src.charCodeAt( pos ) == 112 ) state = 121;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 122;
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
		match = 21;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 34;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 35;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 33;
		match_pos = pos;
		break;

	case 6:
		state = -1;
		match = 30;
		match_pos = pos;
		break;

	case 7:
		state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 8:
		if( info.src.charCodeAt( pos ) == 62 ) state = 25;
		else state = -1;
		match = 31;
		match_pos = pos;
		break;

	case 9:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 26;
		else state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 10:
		if( info.src.charCodeAt( pos ) == 47 ) state = 27;
		else state = -1;
		match = 32;
		match_pos = pos;
		break;

	case 11:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 11;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 26;
		else state = -1;
		match = 42;
		match_pos = pos;
		break;

	case 12:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 13:
		if( info.src.charCodeAt( pos ) == 33 ) state = 29;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 30;
		else if( info.src.charCodeAt( pos ) == 63 ) state = 31;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 14:
		if( info.src.charCodeAt( pos ) == 61 ) state = 32;
		else state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 15:
		if( info.src.charCodeAt( pos ) == 61 ) state = 33;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 16:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 17:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 18:
		state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 19:
		state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 21:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 22:
		state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 23:
		state = -1;
		match = 41;
		match_pos = pos;
		break;

	case 24:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 24;
		else state = -1;
		match = 39;
		match_pos = pos;
		break;

	case 25:
		state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 26:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 26;
		else state = -1;
		match = 44;
		match_pos = pos;
		break;

	case 27:
		state = -1;
		match = 38;
		match_pos = pos;
		break;

	case 28:
		state = -1;
		match = 37;
		match_pos = pos;
		break;

	case 29:
		state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 30:
		state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 31:
		if( info.src.charCodeAt( pos ) == 112 ) state = 64;
		else state = -1;
		match = 46;
		match_pos = pos;
		break;

	case 32:
		state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 33:
		state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 34:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 59 ) || ( info.src.charCodeAt( pos ) >= 61 && info.src.charCodeAt( pos ) <= 62 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 254 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 66;
		else state = -1;
		match = 47;
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
		match = 8;
		match_pos = pos;
		break;

	case 38:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 39:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 40:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 43;
		match_pos = pos;
		break;

	case 41:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 42:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 44:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 45:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 46:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 47:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 47;
		else state = -1;
		match = 40;
		match_pos = pos;
		break;

	case 48:
		if( info.src.charCodeAt( pos ) == 34 ) state = 23;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 33 ) || ( info.src.charCodeAt( pos ) >= 35 && info.src.charCodeAt( pos ) <= 254 ) ) state = 48;
		else state = -1;
		break;

	case 49:
		if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 26;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 49;
		else state = -1;
		match = 42;
		match_pos = pos;
		break;

	case 50:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 35;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 51:
		state = -1;
		match = 46;
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
		match = 45;
		match_pos = pos;
		break;

	case 54:
		if( info.src.charCodeAt( pos ) == 39 ) state = 23;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 54;
		else state = -1;
		break;

	case 55:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 37;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 56:
		if( info.src.charCodeAt( pos ) == 58 ) state = 28;
		else state = -1;
		break;

	case 57:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 38;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 58:
		if( info.src.charCodeAt( pos ) == 62 ) state = 34;
		else state = -1;
		break;

	case 59:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 39;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 60:
		if( info.src.charCodeAt( pos ) == 32 ) state = 62;
		else state = -1;
		break;

	case 61:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 101 ) state = 40;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 62:
		if( info.src.charCodeAt( pos ) == 97 ) state = 68;
		else state = -1;
		break;

	case 63:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 41;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 64:
		if( info.src.charCodeAt( pos ) == 104 ) state = 70;
		else state = -1;
		break;

	case 65:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 42;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 66:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 62 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 254 ) ) state = 34;
		else state = -1;
		break;

	case 67:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 43;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 68:
		if( info.src.charCodeAt( pos ) == 115 ) state = 91;
		else state = -1;
		break;

	case 69:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 44;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 70:
		if( info.src.charCodeAt( pos ) == 112 ) state = 51;
		else state = -1;
		break;

	case 71:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 45;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 72:
		if( info.src.charCodeAt( pos ) == 101 ) state = 74;
		else state = -1;
		break;

	case 73:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 46;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 74:
		if( info.src.charCodeAt( pos ) == 114 ) state = 76;
		else state = -1;
		break;

	case 75:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 32 ) state = 80;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 76:
		if( info.src.charCodeAt( pos ) == 116 ) state = 77;
		else state = -1;
		break;

	case 77:
		if( info.src.charCodeAt( pos ) == 69 ) state = 78;
		else if( info.src.charCodeAt( pos ) == 70 ) state = 79;
		else state = -1;
		break;

	case 78:
		if( info.src.charCodeAt( pos ) == 99 ) state = 81;
		else state = -1;
		break;

	case 79:
		if( info.src.charCodeAt( pos ) == 97 ) state = 82;
		else state = -1;
		break;

	case 80:
		if( info.src.charCodeAt( pos ) == 55 || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 47;
		else state = -1;
		break;

	case 81:
		if( info.src.charCodeAt( pos ) == 104 ) state = 83;
		else state = -1;
		break;

	case 82:
		if( info.src.charCodeAt( pos ) == 105 ) state = 84;
		else state = -1;
		break;

	case 83:
		if( info.src.charCodeAt( pos ) == 111 ) state = 85;
		else state = -1;
		break;

	case 84:
		if( info.src.charCodeAt( pos ) == 108 ) state = 86;
		else state = -1;
		break;

	case 85:
		if( info.src.charCodeAt( pos ) == 32 ) state = 87;
		else state = -1;
		break;

	case 86:
		if( info.src.charCodeAt( pos ) == 36 ) state = 1;
		else if( info.src.charCodeAt( pos ) == 115 ) state = 86;
		else state = -1;
		break;

	case 87:
		if( info.src.charCodeAt( pos ) == 34 ) state = 88;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 89;
		else state = -1;
		break;

	case 88:
		if( info.src.charCodeAt( pos ) == 34 ) state = 86;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 33 ) || ( info.src.charCodeAt( pos ) >= 35 && info.src.charCodeAt( pos ) <= 254 ) ) state = 88;
		else state = -1;
		break;

	case 89:
		if( info.src.charCodeAt( pos ) == 39 ) state = 86;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 89;
		else state = -1;
		break;

	case 90:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 55;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 91:
		if( info.src.charCodeAt( pos ) == 115 ) state = 72;
		else state = -1;
		break;

	case 92:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 57;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 93:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 59;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 94:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 117 ) state = 61;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 95:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 63;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 96:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 65;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 97:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 115 ) state = 61;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 98:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 67;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 99:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 69;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 100:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 71;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 101:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 73;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 102:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 110 ) state = 75;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 103:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 92;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 93;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 104:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 114 ) state = 94;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 105:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 95;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 106:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 96;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 107:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 108 ) state = 97;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 108:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 98;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 109:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 99;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 110:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 100;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 111:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 101;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 112:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 111 ) state = 102;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 113:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 105;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 114:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 106;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 115:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 97 ) state = 107;
		else if( info.src.charCodeAt( pos ) == 117 ) state = 128;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 116:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || info.src.charCodeAt( pos ) == 65 || ( info.src.charCodeAt( pos ) >= 67 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || info.src.charCodeAt( pos ) == 97 || ( info.src.charCodeAt( pos ) >= 99 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 66 || info.src.charCodeAt( pos ) == 98 ) state = 108;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 117:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 109;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 118:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 85 ) || ( info.src.charCodeAt( pos ) >= 87 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 117 ) || ( info.src.charCodeAt( pos ) >= 119 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 86 || info.src.charCodeAt( pos ) == 118 ) state = 110;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 119:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 111;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 120:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 105 ) state = 112;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 121:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 116;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 123;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 122:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 117;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 123:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 118;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 126;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 124:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 119;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 125:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 116 ) state = 120;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 126:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 124;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 127:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 99 ) state = 125;
		else state = -1;
		match = 45;
		match_pos = pos;
		break;

	case 128:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 16;
		else if( info.src.charCodeAt( pos ) == 110 ) state = 127;
		else state = -1;
		match = 45;
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
	case 39:
		{
		 info.att = info.att.substr(1,info.att.length-1); 
		}
		break;

	case 40:
		{
		 info.att = info.att.substr(9,info.att.length-1); 
		}
		break;

	case 41:
		{
		
											info.att = info.att.substr(1,info.att.length-2);
											info.att = info.att.replace( /\\'/g, "'" );
										
		}
		break;

	case 43:
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
	new Array( 0/* PHPScript' */, 1 ),
	new Array( 49/* PHPScript */, 2 ),
	new Array( 49/* PHPScript */, 0 ),
	new Array( 50/* Script */, 3 ),
	new Array( 53/* ClassDefinition */, 5 ),
	new Array( 52/* Member */, 2 ),
	new Array( 52/* Member */, 2 ),
	new Array( 52/* Member */, 0 ),
	new Array( 56/* AttributeMod */, 1 ),
	new Array( 56/* AttributeMod */, 1 ),
	new Array( 56/* AttributeMod */, 1 ),
	new Array( 57/* FunctionMod */, 1 ),
	new Array( 57/* FunctionMod */, 0 ),
	new Array( 57/* FunctionMod */, 1 ),
	new Array( 57/* FunctionMod */, 1 ),
	new Array( 59/* FunctionDefinition */, 7 ),
	new Array( 55/* ClassFunctionDefinition */, 8 ),
	new Array( 54/* AttributeDefinition */, 3 ),
	new Array( 54/* AttributeDefinition */, 5 ),
	new Array( 63/* SingleStmt */, 2 ),
	new Array( 63/* SingleStmt */, 2 ),
	new Array( 63/* SingleStmt */, 2 ),
	new Array( 63/* SingleStmt */, 3 ),
	new Array( 63/* SingleStmt */, 5 ),
	new Array( 63/* SingleStmt */, 3 ),
	new Array( 63/* SingleStmt */, 5 ),
	new Array( 63/* SingleStmt */, 3 ),
	new Array( 63/* SingleStmt */, 5 ),
	new Array( 63/* SingleStmt */, 3 ),
	new Array( 51/* Stmt */, 2 ),
	new Array( 51/* Stmt */, 1 ),
	new Array( 51/* Stmt */, 1 ),
	new Array( 51/* Stmt */, 1 ),
	new Array( 51/* Stmt */, 1 ),
	new Array( 51/* Stmt */, 2 ),
	new Array( 62/* AssignmentStmt */, 3 ),
	new Array( 62/* AssignmentStmt */, 5 ),
	new Array( 65/* AssertStmt */, 2 ),
	new Array( 65/* AssertStmt */, 1 ),
	new Array( 65/* AssertStmt */, 0 ),
	new Array( 58/* FormalParameterList */, 3 ),
	new Array( 58/* FormalParameterList */, 1 ),
	new Array( 58/* FormalParameterList */, 0 ),
	new Array( 61/* Return */, 2 ),
	new Array( 61/* Return */, 1 ),
	new Array( 71/* ExpressionNotFunAccess */, 1 ),
	new Array( 71/* ExpressionNotFunAccess */, 1 ),
	new Array( 71/* ExpressionNotFunAccess */, 1 ),
	new Array( 71/* ExpressionNotFunAccess */, 2 ),
	new Array( 71/* ExpressionNotFunAccess */, 4 ),
	new Array( 71/* ExpressionNotFunAccess */, 3 ),
	new Array( 66/* LValue */, 1 ),
	new Array( 66/* LValue */, 1 ),
	new Array( 66/* LValue */, 2 ),
	new Array( 66/* LValue */, 2 ),
	new Array( 60/* Expression */, 1 ),
	new Array( 60/* Expression */, 1 ),
	new Array( 69/* FunctionInvoke */, 2 ),
	new Array( 69/* FunctionInvoke */, 2 ),
	new Array( 72/* MemberAccess */, 1 ),
	new Array( 72/* MemberAccess */, 1 ),
	new Array( 67/* AttributeAccess */, 3 ),
	new Array( 67/* AttributeAccess */, 3 ),
	new Array( 74/* FunctionAccess */, 5 ),
	new Array( 74/* FunctionAccess */, 3 ),
	new Array( 70/* ActualParameterList */, 3 ),
	new Array( 70/* ActualParameterList */, 1 ),
	new Array( 70/* ActualParameterList */, 0 ),
	new Array( 64/* ArrayIndices */, 4 ),
	new Array( 64/* ArrayIndices */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 3 ),
	new Array( 68/* BinaryExp */, 1 ),
	new Array( 75/* AddSubExp */, 3 ),
	new Array( 75/* AddSubExp */, 3 ),
	new Array( 75/* AddSubExp */, 3 ),
	new Array( 75/* AddSubExp */, 1 ),
	new Array( 76/* MulDivExp */, 3 ),
	new Array( 76/* MulDivExp */, 3 ),
	new Array( 76/* MulDivExp */, 3 ),
	new Array( 76/* MulDivExp */, 1 ),
	new Array( 77/* UnaryExp */, 2 ),
	new Array( 77/* UnaryExp */, 2 ),
	new Array( 77/* UnaryExp */, 1 ),
	new Array( 73/* VarVal */, 1 ),
	new Array( 78/* Value */, 1 ),
	new Array( 78/* Value */, 1 ),
	new Array( 78/* Value */, 1 ),
	new Array( 78/* Value */, 1 ),
	new Array( 78/* Value */, 1 ),
	new Array( 78/* Value */, 1 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 79/* "$" */,-2 , 46/* "ScriptBegin" */,-2 ),
	/* State 1 */ new Array( 46/* "ScriptBegin" */,3 , 79/* "$" */,0 ),
	/* State 2 */ new Array( 79/* "$" */,-1 , 46/* "ScriptBegin" */,-1 ),
	/* State 3 */ new Array( 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 4 */ new Array( 47/* "ScriptEnd" */,45 , 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 5 */ new Array( 47/* "ScriptEnd" */,-30 , 48/* "InternalNonScript" */,-30 , 38/* "//" */,-30 , 7/* "RETURN" */,-30 , 39/* "Variable" */,-30 , 2/* "IF" */,-30 , 4/* "WHILE" */,-30 , 5/* "DO" */,-30 , 6/* "ECHO" */,-30 , 13/* "{" */,-30 , 9/* "ClassToken" */,-30 , 40/* "FunctionName" */,-30 , 15/* "[" */,-30 , 34/* "(" */,-30 , 8/* "NewToken" */,-30 , 45/* "Identifier" */,-30 , 31/* "-" */,-30 , 21/* "!" */,-30 , 41/* "String" */,-30 , 42/* "Integer" */,-30 , 43/* "Boolean" */,-30 , 44/* "Float" */,-30 , 14/* "}" */,-30 ),
	/* State 6 */ new Array( 47/* "ScriptEnd" */,-31 , 48/* "InternalNonScript" */,-31 , 38/* "//" */,-31 , 7/* "RETURN" */,-31 , 39/* "Variable" */,-31 , 2/* "IF" */,-31 , 4/* "WHILE" */,-31 , 5/* "DO" */,-31 , 6/* "ECHO" */,-31 , 13/* "{" */,-31 , 9/* "ClassToken" */,-31 , 40/* "FunctionName" */,-31 , 15/* "[" */,-31 , 34/* "(" */,-31 , 8/* "NewToken" */,-31 , 45/* "Identifier" */,-31 , 31/* "-" */,-31 , 21/* "!" */,-31 , 41/* "String" */,-31 , 42/* "Integer" */,-31 , 43/* "Boolean" */,-31 , 44/* "Float" */,-31 , 14/* "}" */,-31 ),
	/* State 7 */ new Array( 47/* "ScriptEnd" */,-32 , 48/* "InternalNonScript" */,-32 , 38/* "//" */,-32 , 7/* "RETURN" */,-32 , 39/* "Variable" */,-32 , 2/* "IF" */,-32 , 4/* "WHILE" */,-32 , 5/* "DO" */,-32 , 6/* "ECHO" */,-32 , 13/* "{" */,-32 , 9/* "ClassToken" */,-32 , 40/* "FunctionName" */,-32 , 15/* "[" */,-32 , 34/* "(" */,-32 , 8/* "NewToken" */,-32 , 45/* "Identifier" */,-32 , 31/* "-" */,-32 , 21/* "!" */,-32 , 41/* "String" */,-32 , 42/* "Integer" */,-32 , 43/* "Boolean" */,-32 , 44/* "Float" */,-32 , 14/* "}" */,-32 ),
	/* State 8 */ new Array( 47/* "ScriptEnd" */,-33 , 48/* "InternalNonScript" */,-33 , 38/* "//" */,-33 , 7/* "RETURN" */,-33 , 39/* "Variable" */,-33 , 2/* "IF" */,-33 , 4/* "WHILE" */,-33 , 5/* "DO" */,-33 , 6/* "ECHO" */,-33 , 13/* "{" */,-33 , 9/* "ClassToken" */,-33 , 40/* "FunctionName" */,-33 , 15/* "[" */,-33 , 34/* "(" */,-33 , 8/* "NewToken" */,-33 , 45/* "Identifier" */,-33 , 31/* "-" */,-33 , 21/* "!" */,-33 , 41/* "String" */,-33 , 42/* "Integer" */,-33 , 43/* "Boolean" */,-33 , 44/* "Float" */,-33 , 14/* "}" */,-33 ),
	/* State 9 */ new Array( 45/* "Identifier" */,47 , 47/* "ScriptEnd" */,-39 , 48/* "InternalNonScript" */,-39 , 38/* "//" */,-39 , 7/* "RETURN" */,-39 , 39/* "Variable" */,-39 , 2/* "IF" */,-39 , 4/* "WHILE" */,-39 , 5/* "DO" */,-39 , 6/* "ECHO" */,-39 , 13/* "{" */,-39 , 9/* "ClassToken" */,-39 , 40/* "FunctionName" */,-39 , 15/* "[" */,-39 , 34/* "(" */,-39 , 8/* "NewToken" */,-39 , 31/* "-" */,-39 , 21/* "!" */,-39 , 41/* "String" */,-39 , 42/* "Integer" */,-39 , 43/* "Boolean" */,-39 , 44/* "Float" */,-39 ),
	/* State 10 */ new Array( 17/* ";" */,48 ),
	/* State 11 */ new Array( 17/* ";" */,49 , 19/* "." */,-46 ),
	/* State 12 */ new Array( 19/* "." */,50 , 17/* ";" */,51 ),
	/* State 13 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 14 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 15 */ new Array( 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 16 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 17 */ new Array( 20/* "=" */,59 , 15/* "[" */,60 , 36/* "->" */,-90 , 17/* ";" */,-90 , 22/* "==" */,-90 , 29/* "<" */,-90 , 28/* ">" */,-90 , 26/* "<=" */,-90 , 27/* ">=" */,-90 , 23/* "!=" */,-90 , 31/* "-" */,-90 , 30/* "+" */,-90 , 33/* "*" */,-90 , 32/* "/" */,-90 , 34/* "(" */,-90 , 19/* "." */,-90 ),
	/* State 18 */ new Array( 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 19 */ new Array( 45/* "Identifier" */,62 ),
	/* State 20 */ new Array( 34/* "(" */,63 ),
	/* State 21 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 17/* ";" */,-44 ),
	/* State 22 */ new Array( 34/* "(" */,65 , 36/* "->" */,66 , 17/* ";" */,-96 , 22/* "==" */,-96 , 29/* "<" */,-96 , 28/* ">" */,-96 , 26/* "<=" */,-96 , 27/* ">=" */,-96 , 23/* "!=" */,-96 , 31/* "-" */,-96 , 30/* "+" */,-96 , 33/* "*" */,-96 , 32/* "/" */,-96 , 19/* "." */,-96 , 7/* "RETURN" */,-96 , 39/* "Variable" */,-96 , 2/* "IF" */,-96 , 4/* "WHILE" */,-96 , 5/* "DO" */,-96 , 6/* "ECHO" */,-96 , 13/* "{" */,-96 , 15/* "[" */,-96 , 8/* "NewToken" */,-96 , 45/* "Identifier" */,-96 , 21/* "!" */,-96 , 41/* "String" */,-96 , 42/* "Integer" */,-96 , 43/* "Boolean" */,-96 , 44/* "Float" */,-96 , 35/* ")" */,-96 , 18/* "," */,-96 , 16/* "]" */,-96 ),
	/* State 23 */ new Array( 17/* ";" */,-55 , 19/* "." */,-55 , 7/* "RETURN" */,-55 , 39/* "Variable" */,-55 , 2/* "IF" */,-55 , 4/* "WHILE" */,-55 , 5/* "DO" */,-55 , 6/* "ECHO" */,-55 , 13/* "{" */,-55 , 15/* "[" */,-55 , 34/* "(" */,-55 , 8/* "NewToken" */,-55 , 45/* "Identifier" */,-55 , 31/* "-" */,-55 , 21/* "!" */,-55 , 41/* "String" */,-55 , 42/* "Integer" */,-55 , 43/* "Boolean" */,-55 , 44/* "Float" */,-55 , 35/* ")" */,-55 , 18/* "," */,-55 , 22/* "==" */,-55 , 29/* "<" */,-55 , 28/* ">" */,-55 , 26/* "<=" */,-55 , 27/* ">=" */,-55 , 23/* "!=" */,-55 , 30/* "+" */,-55 , 33/* "*" */,-55 , 32/* "/" */,-55 , 16/* "]" */,-55 , 36/* "->" */,-55 ),
	/* State 24 */ new Array( 17/* ";" */,-56 , 19/* "." */,-56 , 7/* "RETURN" */,-56 , 39/* "Variable" */,-56 , 2/* "IF" */,-56 , 4/* "WHILE" */,-56 , 5/* "DO" */,-56 , 6/* "ECHO" */,-56 , 13/* "{" */,-56 , 15/* "[" */,-56 , 34/* "(" */,-56 , 8/* "NewToken" */,-56 , 45/* "Identifier" */,-56 , 31/* "-" */,-56 , 21/* "!" */,-56 , 41/* "String" */,-56 , 42/* "Integer" */,-56 , 43/* "Boolean" */,-56 , 44/* "Float" */,-56 , 35/* ")" */,-56 , 18/* "," */,-56 , 22/* "==" */,-56 , 29/* "<" */,-56 , 28/* ">" */,-56 , 26/* "<=" */,-56 , 27/* ">=" */,-56 , 23/* "!=" */,-56 , 30/* "+" */,-56 , 33/* "*" */,-56 , 32/* "/" */,-56 , 16/* "]" */,-56 , 36/* "->" */,-56 ),
	/* State 25 */ new Array( 36/* "->" */,-51 , 34/* "(" */,-51 , 17/* ";" */,-51 , 22/* "==" */,-51 , 29/* "<" */,-51 , 28/* ">" */,-51 , 26/* "<=" */,-51 , 27/* ">=" */,-51 , 23/* "!=" */,-51 , 31/* "-" */,-51 , 30/* "+" */,-51 , 33/* "*" */,-51 , 32/* "/" */,-51 , 19/* "." */,-51 , 7/* "RETURN" */,-51 , 39/* "Variable" */,-51 , 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 5/* "DO" */,-51 , 6/* "ECHO" */,-51 , 13/* "{" */,-51 , 15/* "[" */,-51 , 8/* "NewToken" */,-51 , 45/* "Identifier" */,-51 , 21/* "!" */,-51 , 41/* "String" */,-51 , 42/* "Integer" */,-51 , 43/* "Boolean" */,-51 , 44/* "Float" */,-51 , 35/* ")" */,-51 , 18/* "," */,-51 , 16/* "]" */,-51 ),
	/* State 26 */ new Array( 15/* "[" */,60 , 36/* "->" */,-52 , 34/* "(" */,-52 , 17/* ";" */,-52 , 22/* "==" */,-52 , 29/* "<" */,-52 , 28/* ">" */,-52 , 26/* "<=" */,-52 , 27/* ">=" */,-52 , 23/* "!=" */,-52 , 31/* "-" */,-52 , 30/* "+" */,-52 , 33/* "*" */,-52 , 32/* "/" */,-52 , 19/* "." */,-52 , 7/* "RETURN" */,-52 , 39/* "Variable" */,-52 , 2/* "IF" */,-52 , 4/* "WHILE" */,-52 , 5/* "DO" */,-52 , 6/* "ECHO" */,-52 , 13/* "{" */,-52 , 8/* "NewToken" */,-52 , 45/* "Identifier" */,-52 , 21/* "!" */,-52 , 41/* "String" */,-52 , 42/* "Integer" */,-52 , 43/* "Boolean" */,-52 , 44/* "Float" */,-52 , 35/* ")" */,-52 , 18/* "," */,-52 , 16/* "]" */,-52 ),
	/* State 27 */ new Array( 16/* "]" */,68 ),
	/* State 28 */ new Array( 23/* "!=" */,69 , 27/* ">=" */,70 , 26/* "<=" */,71 , 28/* ">" */,72 , 29/* "<" */,73 , 22/* "==" */,74 , 17/* ";" */,-45 , 19/* "." */,-45 , 7/* "RETURN" */,-45 , 39/* "Variable" */,-45 , 2/* "IF" */,-45 , 4/* "WHILE" */,-45 , 5/* "DO" */,-45 , 6/* "ECHO" */,-45 , 13/* "{" */,-45 , 15/* "[" */,-45 , 34/* "(" */,-45 , 8/* "NewToken" */,-45 , 45/* "Identifier" */,-45 , 31/* "-" */,-45 , 21/* "!" */,-45 , 41/* "String" */,-45 , 42/* "Integer" */,-45 , 43/* "Boolean" */,-45 , 44/* "Float" */,-45 , 35/* ")" */,-45 , 18/* "," */,-45 , 30/* "+" */,-45 , 33/* "*" */,-45 , 32/* "/" */,-45 , 16/* "]" */,-45 , 36/* "->" */,-45 ),
	/* State 29 */ new Array( 17/* ";" */,-47 , 19/* "." */,-47 , 7/* "RETURN" */,-47 , 39/* "Variable" */,-47 , 2/* "IF" */,-47 , 4/* "WHILE" */,-47 , 5/* "DO" */,-47 , 6/* "ECHO" */,-47 , 13/* "{" */,-47 , 15/* "[" */,-47 , 34/* "(" */,-47 , 8/* "NewToken" */,-47 , 45/* "Identifier" */,-47 , 31/* "-" */,-47 , 21/* "!" */,-47 , 41/* "String" */,-47 , 42/* "Integer" */,-47 , 43/* "Boolean" */,-47 , 44/* "Float" */,-47 , 35/* ")" */,-47 , 18/* "," */,-47 , 22/* "==" */,-47 , 29/* "<" */,-47 , 28/* ">" */,-47 , 26/* "<=" */,-47 , 27/* ">=" */,-47 , 23/* "!=" */,-47 , 30/* "+" */,-47 , 33/* "*" */,-47 , 32/* "/" */,-47 , 16/* "]" */,-47 , 36/* "->" */,-47 ),
	/* State 30 */ new Array( 45/* "Identifier" */,34 , 15/* "[" */,27 , 39/* "Variable" */,80 ),
	/* State 31 */ new Array( 34/* "(" */,31 , 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 31/* "-" */,37 , 21/* "!" */,38 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 32 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 35/* ")" */,-67 , 18/* "," */,-67 ),
	/* State 33 */ new Array( 30/* "+" */,87 , 31/* "-" */,88 , 17/* ";" */,-78 , 22/* "==" */,-78 , 29/* "<" */,-78 , 28/* ">" */,-78 , 26/* "<=" */,-78 , 27/* ">=" */,-78 , 23/* "!=" */,-78 , 19/* "." */,-78 , 7/* "RETURN" */,-78 , 39/* "Variable" */,-78 , 2/* "IF" */,-78 , 4/* "WHILE" */,-78 , 5/* "DO" */,-78 , 6/* "ECHO" */,-78 , 13/* "{" */,-78 , 15/* "[" */,-78 , 34/* "(" */,-78 , 8/* "NewToken" */,-78 , 45/* "Identifier" */,-78 , 21/* "!" */,-78 , 41/* "String" */,-78 , 42/* "Integer" */,-78 , 43/* "Boolean" */,-78 , 44/* "Float" */,-78 , 35/* ")" */,-78 , 18/* "," */,-78 , 33/* "*" */,-78 , 32/* "/" */,-78 , 16/* "]" */,-78 , 36/* "->" */,-78 ),
	/* State 34 */ new Array( 34/* "(" */,89 ),
	/* State 35 */ new Array( 32/* "/" */,90 , 33/* "*" */,91 , 17/* ";" */,-82 , 22/* "==" */,-82 , 29/* "<" */,-82 , 28/* ">" */,-82 , 26/* "<=" */,-82 , 27/* ">=" */,-82 , 23/* "!=" */,-82 , 31/* "-" */,-82 , 30/* "+" */,-82 , 19/* "." */,-82 , 7/* "RETURN" */,-82 , 39/* "Variable" */,-82 , 2/* "IF" */,-82 , 4/* "WHILE" */,-82 , 5/* "DO" */,-82 , 6/* "ECHO" */,-82 , 13/* "{" */,-82 , 15/* "[" */,-82 , 34/* "(" */,-82 , 8/* "NewToken" */,-82 , 45/* "Identifier" */,-82 , 21/* "!" */,-82 , 41/* "String" */,-82 , 42/* "Integer" */,-82 , 43/* "Boolean" */,-82 , 44/* "Float" */,-82 , 35/* ")" */,-82 , 18/* "," */,-82 , 16/* "]" */,-82 , 36/* "->" */,-82 ),
	/* State 36 */ new Array( 17/* ";" */,-86 , 22/* "==" */,-86 , 29/* "<" */,-86 , 28/* ">" */,-86 , 26/* "<=" */,-86 , 27/* ">=" */,-86 , 23/* "!=" */,-86 , 31/* "-" */,-86 , 30/* "+" */,-86 , 33/* "*" */,-86 , 32/* "/" */,-86 , 19/* "." */,-86 , 7/* "RETURN" */,-86 , 39/* "Variable" */,-86 , 2/* "IF" */,-86 , 4/* "WHILE" */,-86 , 5/* "DO" */,-86 , 6/* "ECHO" */,-86 , 13/* "{" */,-86 , 15/* "[" */,-86 , 34/* "(" */,-86 , 8/* "NewToken" */,-86 , 45/* "Identifier" */,-86 , 21/* "!" */,-86 , 41/* "String" */,-86 , 42/* "Integer" */,-86 , 43/* "Boolean" */,-86 , 44/* "Float" */,-86 , 35/* ")" */,-86 , 18/* "," */,-86 , 16/* "]" */,-86 , 36/* "->" */,-86 ),
	/* State 37 */ new Array( 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 39/* "Variable" */,80 , 15/* "[" */,27 , 45/* "Identifier" */,34 ),
	/* State 38 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 39 */ new Array( 17/* ";" */,-89 , 22/* "==" */,-89 , 29/* "<" */,-89 , 28/* ">" */,-89 , 26/* "<=" */,-89 , 27/* ">=" */,-89 , 23/* "!=" */,-89 , 31/* "-" */,-89 , 30/* "+" */,-89 , 33/* "*" */,-89 , 32/* "/" */,-89 , 19/* "." */,-89 , 7/* "RETURN" */,-89 , 39/* "Variable" */,-89 , 2/* "IF" */,-89 , 4/* "WHILE" */,-89 , 5/* "DO" */,-89 , 6/* "ECHO" */,-89 , 13/* "{" */,-89 , 15/* "[" */,-89 , 34/* "(" */,-89 , 8/* "NewToken" */,-89 , 45/* "Identifier" */,-89 , 21/* "!" */,-89 , 41/* "String" */,-89 , 42/* "Integer" */,-89 , 43/* "Boolean" */,-89 , 44/* "Float" */,-89 , 35/* ")" */,-89 , 18/* "," */,-89 , 16/* "]" */,-89 , 36/* "->" */,-89 ),
	/* State 40 */ new Array( 17/* ";" */,-92 , 22/* "==" */,-92 , 29/* "<" */,-92 , 28/* ">" */,-92 , 26/* "<=" */,-92 , 27/* ">=" */,-92 , 23/* "!=" */,-92 , 31/* "-" */,-92 , 30/* "+" */,-92 , 33/* "*" */,-92 , 32/* "/" */,-92 , 19/* "." */,-92 , 7/* "RETURN" */,-92 , 39/* "Variable" */,-92 , 2/* "IF" */,-92 , 4/* "WHILE" */,-92 , 5/* "DO" */,-92 , 6/* "ECHO" */,-92 , 13/* "{" */,-92 , 15/* "[" */,-92 , 34/* "(" */,-92 , 8/* "NewToken" */,-92 , 45/* "Identifier" */,-92 , 21/* "!" */,-92 , 41/* "String" */,-92 , 42/* "Integer" */,-92 , 43/* "Boolean" */,-92 , 44/* "Float" */,-92 , 35/* ")" */,-92 , 18/* "," */,-92 , 16/* "]" */,-92 , 36/* "->" */,-92 ),
	/* State 41 */ new Array( 17/* ";" */,-93 , 22/* "==" */,-93 , 29/* "<" */,-93 , 28/* ">" */,-93 , 26/* "<=" */,-93 , 27/* ">=" */,-93 , 23/* "!=" */,-93 , 31/* "-" */,-93 , 30/* "+" */,-93 , 33/* "*" */,-93 , 32/* "/" */,-93 , 19/* "." */,-93 , 7/* "RETURN" */,-93 , 39/* "Variable" */,-93 , 2/* "IF" */,-93 , 4/* "WHILE" */,-93 , 5/* "DO" */,-93 , 6/* "ECHO" */,-93 , 13/* "{" */,-93 , 15/* "[" */,-93 , 34/* "(" */,-93 , 8/* "NewToken" */,-93 , 45/* "Identifier" */,-93 , 21/* "!" */,-93 , 41/* "String" */,-93 , 42/* "Integer" */,-93 , 43/* "Boolean" */,-93 , 44/* "Float" */,-93 , 35/* ")" */,-93 , 18/* "," */,-93 , 16/* "]" */,-93 , 36/* "->" */,-93 ),
	/* State 42 */ new Array( 17/* ";" */,-94 , 22/* "==" */,-94 , 29/* "<" */,-94 , 28/* ">" */,-94 , 26/* "<=" */,-94 , 27/* ">=" */,-94 , 23/* "!=" */,-94 , 31/* "-" */,-94 , 30/* "+" */,-94 , 33/* "*" */,-94 , 32/* "/" */,-94 , 19/* "." */,-94 , 7/* "RETURN" */,-94 , 39/* "Variable" */,-94 , 2/* "IF" */,-94 , 4/* "WHILE" */,-94 , 5/* "DO" */,-94 , 6/* "ECHO" */,-94 , 13/* "{" */,-94 , 15/* "[" */,-94 , 34/* "(" */,-94 , 8/* "NewToken" */,-94 , 45/* "Identifier" */,-94 , 21/* "!" */,-94 , 41/* "String" */,-94 , 42/* "Integer" */,-94 , 43/* "Boolean" */,-94 , 44/* "Float" */,-94 , 35/* ")" */,-94 , 18/* "," */,-94 , 16/* "]" */,-94 , 36/* "->" */,-94 ),
	/* State 43 */ new Array( 17/* ";" */,-95 , 22/* "==" */,-95 , 29/* "<" */,-95 , 28/* ">" */,-95 , 26/* "<=" */,-95 , 27/* ">=" */,-95 , 23/* "!=" */,-95 , 31/* "-" */,-95 , 30/* "+" */,-95 , 33/* "*" */,-95 , 32/* "/" */,-95 , 19/* "." */,-95 , 7/* "RETURN" */,-95 , 39/* "Variable" */,-95 , 2/* "IF" */,-95 , 4/* "WHILE" */,-95 , 5/* "DO" */,-95 , 6/* "ECHO" */,-95 , 13/* "{" */,-95 , 15/* "[" */,-95 , 34/* "(" */,-95 , 8/* "NewToken" */,-95 , 45/* "Identifier" */,-95 , 21/* "!" */,-95 , 41/* "String" */,-95 , 42/* "Integer" */,-95 , 43/* "Boolean" */,-95 , 44/* "Float" */,-95 , 35/* ")" */,-95 , 18/* "," */,-95 , 16/* "]" */,-95 , 36/* "->" */,-95 ),
	/* State 44 */ new Array( 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 47/* "ScriptEnd" */,-29 , 14/* "}" */,-29 ),
	/* State 45 */ new Array( 79/* "$" */,-3 , 46/* "ScriptBegin" */,-3 ),
	/* State 46 */ new Array( 47/* "ScriptEnd" */,-34 , 48/* "InternalNonScript" */,-34 , 38/* "//" */,-34 , 7/* "RETURN" */,-34 , 39/* "Variable" */,-34 , 2/* "IF" */,-34 , 4/* "WHILE" */,-34 , 5/* "DO" */,-34 , 6/* "ECHO" */,-34 , 13/* "{" */,-34 , 9/* "ClassToken" */,-34 , 40/* "FunctionName" */,-34 , 15/* "[" */,-34 , 34/* "(" */,-34 , 8/* "NewToken" */,-34 , 45/* "Identifier" */,-34 , 31/* "-" */,-34 , 21/* "!" */,-34 , 41/* "String" */,-34 , 42/* "Integer" */,-34 , 43/* "Boolean" */,-34 , 44/* "Float" */,-34 , 14/* "}" */,-34 ),
	/* State 47 */ new Array( 41/* "String" */,95 , 47/* "ScriptEnd" */,-38 , 48/* "InternalNonScript" */,-38 , 38/* "//" */,-38 , 7/* "RETURN" */,-38 , 39/* "Variable" */,-38 , 2/* "IF" */,-38 , 4/* "WHILE" */,-38 , 5/* "DO" */,-38 , 6/* "ECHO" */,-38 , 13/* "{" */,-38 , 9/* "ClassToken" */,-38 , 40/* "FunctionName" */,-38 , 15/* "[" */,-38 , 34/* "(" */,-38 , 8/* "NewToken" */,-38 , 45/* "Identifier" */,-38 , 31/* "-" */,-38 , 21/* "!" */,-38 , 42/* "Integer" */,-38 , 43/* "Boolean" */,-38 , 44/* "Float" */,-38 , 14/* "}" */,-38 ),
	/* State 48 */ new Array( 47/* "ScriptEnd" */,-19 , 48/* "InternalNonScript" */,-19 , 38/* "//" */,-19 , 7/* "RETURN" */,-19 , 39/* "Variable" */,-19 , 2/* "IF" */,-19 , 4/* "WHILE" */,-19 , 5/* "DO" */,-19 , 6/* "ECHO" */,-19 , 13/* "{" */,-19 , 9/* "ClassToken" */,-19 , 40/* "FunctionName" */,-19 , 15/* "[" */,-19 , 34/* "(" */,-19 , 8/* "NewToken" */,-19 , 45/* "Identifier" */,-19 , 31/* "-" */,-19 , 21/* "!" */,-19 , 41/* "String" */,-19 , 42/* "Integer" */,-19 , 43/* "Boolean" */,-19 , 44/* "Float" */,-19 , 14/* "}" */,-19 , 3/* "ELSE" */,-19 ),
	/* State 49 */ new Array( 47/* "ScriptEnd" */,-20 , 48/* "InternalNonScript" */,-20 , 38/* "//" */,-20 , 7/* "RETURN" */,-20 , 39/* "Variable" */,-20 , 2/* "IF" */,-20 , 4/* "WHILE" */,-20 , 5/* "DO" */,-20 , 6/* "ECHO" */,-20 , 13/* "{" */,-20 , 9/* "ClassToken" */,-20 , 40/* "FunctionName" */,-20 , 15/* "[" */,-20 , 34/* "(" */,-20 , 8/* "NewToken" */,-20 , 45/* "Identifier" */,-20 , 31/* "-" */,-20 , 21/* "!" */,-20 , 41/* "String" */,-20 , 42/* "Integer" */,-20 , 43/* "Boolean" */,-20 , 44/* "Float" */,-20 , 14/* "}" */,-20 , 3/* "ELSE" */,-20 ),
	/* State 50 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 51 */ new Array( 47/* "ScriptEnd" */,-21 , 48/* "InternalNonScript" */,-21 , 38/* "//" */,-21 , 7/* "RETURN" */,-21 , 39/* "Variable" */,-21 , 2/* "IF" */,-21 , 4/* "WHILE" */,-21 , 5/* "DO" */,-21 , 6/* "ECHO" */,-21 , 13/* "{" */,-21 , 9/* "ClassToken" */,-21 , 40/* "FunctionName" */,-21 , 15/* "[" */,-21 , 34/* "(" */,-21 , 8/* "NewToken" */,-21 , 45/* "Identifier" */,-21 , 31/* "-" */,-21 , 21/* "!" */,-21 , 41/* "String" */,-21 , 42/* "Integer" */,-21 , 43/* "Boolean" */,-21 , 44/* "Float" */,-21 , 14/* "}" */,-21 , 3/* "ELSE" */,-21 ),
	/* State 52 */ new Array( 19/* "." */,50 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 53 */ new Array( 7/* "RETURN" */,-46 , 39/* "Variable" */,-46 , 2/* "IF" */,-46 , 4/* "WHILE" */,-46 , 5/* "DO" */,-46 , 6/* "ECHO" */,-46 , 13/* "{" */,-46 , 15/* "[" */,-46 , 34/* "(" */,-46 , 8/* "NewToken" */,-46 , 45/* "Identifier" */,-46 , 31/* "-" */,-46 , 21/* "!" */,-46 , 41/* "String" */,-46 , 42/* "Integer" */,-46 , 43/* "Boolean" */,-46 , 44/* "Float" */,-46 , 19/* "." */,-46 , 17/* ";" */,-46 , 35/* ")" */,-46 , 18/* "," */,-46 , 22/* "==" */,-46 , 29/* "<" */,-46 , 28/* ">" */,-46 , 26/* "<=" */,-46 , 27/* ">=" */,-46 , 23/* "!=" */,-46 , 30/* "+" */,-46 , 33/* "*" */,-46 , 32/* "/" */,-46 , 16/* "]" */,-46 , 36/* "->" */,-46 ),
	/* State 54 */ new Array( 20/* "=" */,59 , 15/* "[" */,60 , 36/* "->" */,-90 , 7/* "RETURN" */,-90 , 39/* "Variable" */,-90 , 2/* "IF" */,-90 , 4/* "WHILE" */,-90 , 5/* "DO" */,-90 , 6/* "ECHO" */,-90 , 13/* "{" */,-90 , 34/* "(" */,-90 , 8/* "NewToken" */,-90 , 45/* "Identifier" */,-90 , 31/* "-" */,-90 , 21/* "!" */,-90 , 41/* "String" */,-90 , 42/* "Integer" */,-90 , 43/* "Boolean" */,-90 , 44/* "Float" */,-90 , 22/* "==" */,-90 , 29/* "<" */,-90 , 28/* ">" */,-90 , 26/* "<=" */,-90 , 27/* ">=" */,-90 , 23/* "!=" */,-90 , 30/* "+" */,-90 , 33/* "*" */,-90 , 32/* "/" */,-90 , 19/* "." */,-90 , 17/* ";" */,-90 , 35/* ")" */,-90 , 18/* "," */,-90 , 16/* "]" */,-90 ),
	/* State 55 */ new Array( 19/* "." */,50 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 56 */ new Array( 4/* "WHILE" */,100 ),
	/* State 57 */ new Array( 19/* "." */,50 , 17/* ";" */,101 ),
	/* State 58 */ new Array( 15/* "[" */,102 , 20/* "=" */,103 , 17/* ";" */,-48 , 19/* "." */,-48 ),
	/* State 59 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 60 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 61 */ new Array( 14/* "}" */,106 , 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 62 */ new Array( 13/* "{" */,107 ),
	/* State 63 */ new Array( 39/* "Variable" */,109 , 35/* ")" */,-42 , 18/* "," */,-42 ),
	/* State 64 */ new Array( 19/* "." */,50 , 17/* ";" */,-43 ),
	/* State 65 */ new Array( 18/* "," */,-58 , 34/* "(" */,-58 , 39/* "Variable" */,-58 , 15/* "[" */,-58 , 8/* "NewToken" */,-58 , 45/* "Identifier" */,-58 , 31/* "-" */,-58 , 21/* "!" */,-58 , 41/* "String" */,-58 , 42/* "Integer" */,-58 , 43/* "Boolean" */,-58 , 44/* "Float" */,-58 , 35/* ")" */,-58 , 19/* "." */,-58 , 36/* "->" */,-58 , 17/* ";" */,-58 , 22/* "==" */,-58 , 29/* "<" */,-58 , 28/* ">" */,-58 , 26/* "<=" */,-58 , 27/* ">=" */,-58 , 23/* "!=" */,-58 , 30/* "+" */,-58 , 33/* "*" */,-58 , 32/* "/" */,-58 , 7/* "RETURN" */,-58 , 2/* "IF" */,-58 , 4/* "WHILE" */,-58 , 5/* "DO" */,-58 , 6/* "ECHO" */,-58 , 13/* "{" */,-58 , 16/* "]" */,-58 ),
	/* State 66 */ new Array( 45/* "Identifier" */,112 , 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 67 */ new Array( 15/* "[" */,102 , 36/* "->" */,-53 , 34/* "(" */,-53 , 17/* ";" */,-53 , 22/* "==" */,-53 , 29/* "<" */,-53 , 28/* ">" */,-53 , 26/* "<=" */,-53 , 27/* ">=" */,-53 , 23/* "!=" */,-53 , 31/* "-" */,-53 , 30/* "+" */,-53 , 33/* "*" */,-53 , 32/* "/" */,-53 , 19/* "." */,-53 , 7/* "RETURN" */,-53 , 39/* "Variable" */,-53 , 2/* "IF" */,-53 , 4/* "WHILE" */,-53 , 5/* "DO" */,-53 , 6/* "ECHO" */,-53 , 13/* "{" */,-53 , 8/* "NewToken" */,-53 , 45/* "Identifier" */,-53 , 21/* "!" */,-53 , 41/* "String" */,-53 , 42/* "Integer" */,-53 , 43/* "Boolean" */,-53 , 44/* "Float" */,-53 , 35/* ")" */,-53 , 18/* "," */,-53 , 16/* "]" */,-53 ),
	/* State 68 */ new Array( 36/* "->" */,-54 , 34/* "(" */,-54 , 17/* ";" */,-54 , 22/* "==" */,-54 , 29/* "<" */,-54 , 28/* ">" */,-54 , 26/* "<=" */,-54 , 27/* ">=" */,-54 , 23/* "!=" */,-54 , 31/* "-" */,-54 , 30/* "+" */,-54 , 33/* "*" */,-54 , 32/* "/" */,-54 , 19/* "." */,-54 , 7/* "RETURN" */,-54 , 39/* "Variable" */,-54 , 2/* "IF" */,-54 , 4/* "WHILE" */,-54 , 5/* "DO" */,-54 , 6/* "ECHO" */,-54 , 13/* "{" */,-54 , 15/* "[" */,-54 , 8/* "NewToken" */,-54 , 45/* "Identifier" */,-54 , 21/* "!" */,-54 , 41/* "String" */,-54 , 42/* "Integer" */,-54 , 43/* "Boolean" */,-54 , 44/* "Float" */,-54 , 35/* ")" */,-54 , 18/* "," */,-54 , 16/* "]" */,-54 ),
	/* State 69 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 70 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 71 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 72 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 73 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 74 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 75 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 35/* ")" */,-67 , 18/* "," */,-67 ),
	/* State 76 */ new Array( 36/* "->" */,122 , 34/* "(" */,65 ),
	/* State 77 */ new Array( 15/* "[" */,60 , 34/* "(" */,-52 , 36/* "->" */,-52 ),
	/* State 78 */ new Array( 34/* "(" */,-59 , 36/* "->" */,-59 , 17/* ";" */,-59 , 22/* "==" */,-59 , 29/* "<" */,-59 , 28/* ">" */,-59 , 26/* "<=" */,-59 , 27/* ">=" */,-59 , 23/* "!=" */,-59 , 31/* "-" */,-59 , 30/* "+" */,-59 , 33/* "*" */,-59 , 32/* "/" */,-59 , 19/* "." */,-59 , 7/* "RETURN" */,-59 , 39/* "Variable" */,-59 , 2/* "IF" */,-59 , 4/* "WHILE" */,-59 , 5/* "DO" */,-59 , 6/* "ECHO" */,-59 , 13/* "{" */,-59 , 15/* "[" */,-59 , 8/* "NewToken" */,-59 , 45/* "Identifier" */,-59 , 21/* "!" */,-59 , 41/* "String" */,-59 , 42/* "Integer" */,-59 , 43/* "Boolean" */,-59 , 44/* "Float" */,-59 , 35/* ")" */,-59 , 18/* "," */,-59 , 16/* "]" */,-59 ),
	/* State 79 */ new Array( 34/* "(" */,-60 , 36/* "->" */,-60 , 17/* ";" */,-60 , 22/* "==" */,-60 , 29/* "<" */,-60 , 28/* ">" */,-60 , 26/* "<=" */,-60 , 27/* ">=" */,-60 , 23/* "!=" */,-60 , 31/* "-" */,-60 , 30/* "+" */,-60 , 33/* "*" */,-60 , 32/* "/" */,-60 , 19/* "." */,-60 , 7/* "RETURN" */,-60 , 39/* "Variable" */,-60 , 2/* "IF" */,-60 , 4/* "WHILE" */,-60 , 5/* "DO" */,-60 , 6/* "ECHO" */,-60 , 13/* "{" */,-60 , 15/* "[" */,-60 , 8/* "NewToken" */,-60 , 45/* "Identifier" */,-60 , 21/* "!" */,-60 , 41/* "String" */,-60 , 42/* "Integer" */,-60 , 43/* "Boolean" */,-60 , 44/* "Float" */,-60 , 35/* ")" */,-60 , 18/* "," */,-60 , 16/* "]" */,-60 ),
	/* State 80 */ new Array( 34/* "(" */,-90 , 15/* "[" */,-90 , 36/* "->" */,-90 , 17/* ";" */,-90 , 22/* "==" */,-90 , 29/* "<" */,-90 , 28/* ">" */,-90 , 26/* "<=" */,-90 , 27/* ">=" */,-90 , 23/* "!=" */,-90 , 31/* "-" */,-90 , 30/* "+" */,-90 , 33/* "*" */,-90 , 32/* "/" */,-90 , 19/* "." */,-90 , 7/* "RETURN" */,-90 , 39/* "Variable" */,-90 , 2/* "IF" */,-90 , 4/* "WHILE" */,-90 , 5/* "DO" */,-90 , 6/* "ECHO" */,-90 , 13/* "{" */,-90 , 8/* "NewToken" */,-90 , 45/* "Identifier" */,-90 , 21/* "!" */,-90 , 41/* "String" */,-90 , 42/* "Integer" */,-90 , 43/* "Boolean" */,-90 , 44/* "Float" */,-90 , 35/* ")" */,-90 , 18/* "," */,-90 , 16/* "]" */,-90 ),
	/* State 81 */ new Array( 32/* "/" */,90 , 33/* "*" */,91 , 35/* ")" */,123 , 22/* "==" */,-82 , 29/* "<" */,-82 , 28/* ">" */,-82 , 26/* "<=" */,-82 , 27/* ">=" */,-82 , 23/* "!=" */,-82 , 31/* "-" */,-82 , 30/* "+" */,-82 , 19/* "." */,-82 ),
	/* State 82 */ new Array( 30/* "+" */,87 , 31/* "-" */,88 , 35/* ")" */,124 , 22/* "==" */,-78 , 29/* "<" */,-78 , 28/* ">" */,-78 , 26/* "<=" */,-78 , 27/* ">=" */,-78 , 23/* "!=" */,-78 , 19/* "." */,-78 ),
	/* State 83 */ new Array( 23/* "!=" */,69 , 27/* ">=" */,70 , 26/* "<=" */,71 , 28/* ">" */,72 , 29/* "<" */,73 , 22/* "==" */,74 , 35/* ")" */,125 , 19/* "." */,-45 ),
	/* State 84 */ new Array( 19/* "." */,50 , 35/* ")" */,126 ),
	/* State 85 */ new Array( 18/* "," */,127 , 35/* ")" */,128 ),
	/* State 86 */ new Array( 19/* "." */,50 , 35/* ")" */,-66 , 18/* "," */,-66 ),
	/* State 87 */ new Array( 34/* "(" */,130 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 39/* "Variable" */,80 , 15/* "[" */,27 , 45/* "Identifier" */,34 ),
	/* State 88 */ new Array( 34/* "(" */,130 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 39/* "Variable" */,80 , 15/* "[" */,27 , 45/* "Identifier" */,34 ),
	/* State 89 */ new Array( 18/* "," */,-57 , 34/* "(" */,-57 , 39/* "Variable" */,-57 , 15/* "[" */,-57 , 8/* "NewToken" */,-57 , 45/* "Identifier" */,-57 , 31/* "-" */,-57 , 21/* "!" */,-57 , 41/* "String" */,-57 , 42/* "Integer" */,-57 , 43/* "Boolean" */,-57 , 44/* "Float" */,-57 , 35/* ")" */,-57 ),
	/* State 90 */ new Array( 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 39/* "Variable" */,80 , 15/* "[" */,27 , 45/* "Identifier" */,34 ),
	/* State 91 */ new Array( 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 39/* "Variable" */,80 , 15/* "[" */,27 , 45/* "Identifier" */,34 ),
	/* State 92 */ new Array( 17/* ";" */,-87 , 22/* "==" */,-87 , 29/* "<" */,-87 , 28/* ">" */,-87 , 26/* "<=" */,-87 , 27/* ">=" */,-87 , 23/* "!=" */,-87 , 31/* "-" */,-87 , 30/* "+" */,-87 , 33/* "*" */,-87 , 32/* "/" */,-87 , 19/* "." */,-87 , 7/* "RETURN" */,-87 , 39/* "Variable" */,-87 , 2/* "IF" */,-87 , 4/* "WHILE" */,-87 , 5/* "DO" */,-87 , 6/* "ECHO" */,-87 , 13/* "{" */,-87 , 15/* "[" */,-87 , 34/* "(" */,-87 , 8/* "NewToken" */,-87 , 45/* "Identifier" */,-87 , 21/* "!" */,-87 , 41/* "String" */,-87 , 42/* "Integer" */,-87 , 43/* "Boolean" */,-87 , 44/* "Float" */,-87 , 35/* ")" */,-87 , 18/* "," */,-87 , 16/* "]" */,-87 , 36/* "->" */,-87 ),
	/* State 93 */ new Array( 34/* "(" */,65 , 36/* "->" */,122 , 17/* ";" */,-96 , 22/* "==" */,-96 , 29/* "<" */,-96 , 28/* ">" */,-96 , 26/* "<=" */,-96 , 27/* ">=" */,-96 , 23/* "!=" */,-96 , 31/* "-" */,-96 , 30/* "+" */,-96 , 33/* "*" */,-96 , 32/* "/" */,-96 , 19/* "." */,-96 , 7/* "RETURN" */,-96 , 39/* "Variable" */,-96 , 2/* "IF" */,-96 , 4/* "WHILE" */,-96 , 5/* "DO" */,-96 , 6/* "ECHO" */,-96 , 13/* "{" */,-96 , 15/* "[" */,-96 , 8/* "NewToken" */,-96 , 45/* "Identifier" */,-96 , 21/* "!" */,-96 , 41/* "String" */,-96 , 42/* "Integer" */,-96 , 43/* "Boolean" */,-96 , 44/* "Float" */,-96 , 35/* ")" */,-96 , 18/* "," */,-96 , 16/* "]" */,-96 ),
	/* State 94 */ new Array( 19/* "." */,50 , 17/* ";" */,-88 , 22/* "==" */,-88 , 29/* "<" */,-88 , 28/* ">" */,-88 , 26/* "<=" */,-88 , 27/* ">=" */,-88 , 23/* "!=" */,-88 , 31/* "-" */,-88 , 30/* "+" */,-88 , 33/* "*" */,-88 , 32/* "/" */,-88 , 7/* "RETURN" */,-88 , 39/* "Variable" */,-88 , 2/* "IF" */,-88 , 4/* "WHILE" */,-88 , 5/* "DO" */,-88 , 6/* "ECHO" */,-88 , 13/* "{" */,-88 , 15/* "[" */,-88 , 34/* "(" */,-88 , 8/* "NewToken" */,-88 , 45/* "Identifier" */,-88 , 21/* "!" */,-88 , 41/* "String" */,-88 , 42/* "Integer" */,-88 , 43/* "Boolean" */,-88 , 44/* "Float" */,-88 , 35/* ")" */,-88 , 18/* "," */,-88 , 16/* "]" */,-88 , 36/* "->" */,-88 ),
	/* State 95 */ new Array( 47/* "ScriptEnd" */,-37 , 48/* "InternalNonScript" */,-37 , 38/* "//" */,-37 , 7/* "RETURN" */,-37 , 39/* "Variable" */,-37 , 2/* "IF" */,-37 , 4/* "WHILE" */,-37 , 5/* "DO" */,-37 , 6/* "ECHO" */,-37 , 13/* "{" */,-37 , 9/* "ClassToken" */,-37 , 40/* "FunctionName" */,-37 , 15/* "[" */,-37 , 34/* "(" */,-37 , 8/* "NewToken" */,-37 , 45/* "Identifier" */,-37 , 31/* "-" */,-37 , 21/* "!" */,-37 , 41/* "String" */,-37 , 42/* "Integer" */,-37 , 43/* "Boolean" */,-37 , 44/* "Float" */,-37 , 14/* "}" */,-37 ),
	/* State 96 */ new Array( 19/* "." */,50 , 17/* ";" */,-76 , 22/* "==" */,-76 , 29/* "<" */,-76 , 28/* ">" */,-76 , 26/* "<=" */,-76 , 27/* ">=" */,-76 , 23/* "!=" */,-76 , 7/* "RETURN" */,-76 , 39/* "Variable" */,-76 , 2/* "IF" */,-76 , 4/* "WHILE" */,-76 , 5/* "DO" */,-76 , 6/* "ECHO" */,-76 , 13/* "{" */,-76 , 15/* "[" */,-76 , 34/* "(" */,-76 , 8/* "NewToken" */,-76 , 45/* "Identifier" */,-76 , 31/* "-" */,-76 , 21/* "!" */,-76 , 41/* "String" */,-76 , 42/* "Integer" */,-76 , 43/* "Boolean" */,-76 , 44/* "Float" */,-76 , 35/* ")" */,-76 , 18/* "," */,-76 , 30/* "+" */,-76 , 33/* "*" */,-76 , 32/* "/" */,-76 , 16/* "]" */,-76 , 36/* "->" */,-76 ),
	/* State 97 */ new Array( 3/* "ELSE" */,134 , 47/* "ScriptEnd" */,-22 , 48/* "InternalNonScript" */,-22 , 38/* "//" */,-22 , 7/* "RETURN" */,-22 , 39/* "Variable" */,-22 , 2/* "IF" */,-22 , 4/* "WHILE" */,-22 , 5/* "DO" */,-22 , 6/* "ECHO" */,-22 , 13/* "{" */,-22 , 9/* "ClassToken" */,-22 , 40/* "FunctionName" */,-22 , 15/* "[" */,-22 , 34/* "(" */,-22 , 8/* "NewToken" */,-22 , 45/* "Identifier" */,-22 , 31/* "-" */,-22 , 21/* "!" */,-22 , 41/* "String" */,-22 , 42/* "Integer" */,-22 , 43/* "Boolean" */,-22 , 44/* "Float" */,-22 , 14/* "}" */,-22 ),
	/* State 98 */ new Array( 15/* "[" */,102 , 7/* "RETURN" */,-48 , 39/* "Variable" */,-48 , 2/* "IF" */,-48 , 4/* "WHILE" */,-48 , 5/* "DO" */,-48 , 6/* "ECHO" */,-48 , 13/* "{" */,-48 , 34/* "(" */,-48 , 8/* "NewToken" */,-48 , 45/* "Identifier" */,-48 , 31/* "-" */,-48 , 21/* "!" */,-48 , 41/* "String" */,-48 , 42/* "Integer" */,-48 , 43/* "Boolean" */,-48 , 44/* "Float" */,-48 , 19/* "." */,-48 , 17/* ";" */,-48 , 35/* ")" */,-48 , 18/* "," */,-48 , 22/* "==" */,-48 , 29/* "<" */,-48 , 28/* ">" */,-48 , 26/* "<=" */,-48 , 27/* ">=" */,-48 , 23/* "!=" */,-48 , 30/* "+" */,-48 , 33/* "*" */,-48 , 32/* "/" */,-48 , 16/* "]" */,-48 , 36/* "->" */,-48 ),
	/* State 99 */ new Array( 47/* "ScriptEnd" */,-24 , 48/* "InternalNonScript" */,-24 , 38/* "//" */,-24 , 7/* "RETURN" */,-24 , 39/* "Variable" */,-24 , 2/* "IF" */,-24 , 4/* "WHILE" */,-24 , 5/* "DO" */,-24 , 6/* "ECHO" */,-24 , 13/* "{" */,-24 , 9/* "ClassToken" */,-24 , 40/* "FunctionName" */,-24 , 15/* "[" */,-24 , 34/* "(" */,-24 , 8/* "NewToken" */,-24 , 45/* "Identifier" */,-24 , 31/* "-" */,-24 , 21/* "!" */,-24 , 41/* "String" */,-24 , 42/* "Integer" */,-24 , 43/* "Boolean" */,-24 , 44/* "Float" */,-24 , 14/* "}" */,-24 , 3/* "ELSE" */,-24 ),
	/* State 100 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 101 */ new Array( 47/* "ScriptEnd" */,-26 , 48/* "InternalNonScript" */,-26 , 38/* "//" */,-26 , 7/* "RETURN" */,-26 , 39/* "Variable" */,-26 , 2/* "IF" */,-26 , 4/* "WHILE" */,-26 , 5/* "DO" */,-26 , 6/* "ECHO" */,-26 , 13/* "{" */,-26 , 9/* "ClassToken" */,-26 , 40/* "FunctionName" */,-26 , 15/* "[" */,-26 , 34/* "(" */,-26 , 8/* "NewToken" */,-26 , 45/* "Identifier" */,-26 , 31/* "-" */,-26 , 21/* "!" */,-26 , 41/* "String" */,-26 , 42/* "Integer" */,-26 , 43/* "Boolean" */,-26 , 44/* "Float" */,-26 , 14/* "}" */,-26 , 3/* "ELSE" */,-26 ),
	/* State 102 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 103 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 104 */ new Array( 19/* "." */,50 , 17/* ";" */,-35 , 7/* "RETURN" */,-35 , 39/* "Variable" */,-35 , 2/* "IF" */,-35 , 4/* "WHILE" */,-35 , 5/* "DO" */,-35 , 6/* "ECHO" */,-35 , 13/* "{" */,-35 , 15/* "[" */,-35 , 34/* "(" */,-35 , 8/* "NewToken" */,-35 , 45/* "Identifier" */,-35 , 31/* "-" */,-35 , 21/* "!" */,-35 , 41/* "String" */,-35 , 42/* "Integer" */,-35 , 43/* "Boolean" */,-35 , 44/* "Float" */,-35 , 35/* ")" */,-35 , 18/* "," */,-35 , 22/* "==" */,-35 , 29/* "<" */,-35 , 28/* ">" */,-35 , 26/* "<=" */,-35 , 27/* ">=" */,-35 , 23/* "!=" */,-35 , 30/* "+" */,-35 , 33/* "*" */,-35 , 32/* "/" */,-35 , 16/* "]" */,-35 , 36/* "->" */,-35 ),
	/* State 105 */ new Array( 19/* "." */,50 , 16/* "]" */,138 ),
	/* State 106 */ new Array( 47/* "ScriptEnd" */,-28 , 48/* "InternalNonScript" */,-28 , 38/* "//" */,-28 , 7/* "RETURN" */,-28 , 39/* "Variable" */,-28 , 2/* "IF" */,-28 , 4/* "WHILE" */,-28 , 5/* "DO" */,-28 , 6/* "ECHO" */,-28 , 13/* "{" */,-28 , 9/* "ClassToken" */,-28 , 40/* "FunctionName" */,-28 , 15/* "[" */,-28 , 34/* "(" */,-28 , 8/* "NewToken" */,-28 , 45/* "Identifier" */,-28 , 31/* "-" */,-28 , 21/* "!" */,-28 , 41/* "String" */,-28 , 42/* "Integer" */,-28 , 43/* "Boolean" */,-28 , 44/* "Float" */,-28 , 14/* "}" */,-28 , 3/* "ELSE" */,-28 ),
	/* State 107 */ new Array( 14/* "}" */,-7 , 10/* "PublicToken" */,-7 , 12/* "ProtectedToken" */,-7 , 11/* "PrivateToken" */,-7 , 40/* "FunctionName" */,-7 ),
	/* State 108 */ new Array( 18/* "," */,140 , 35/* ")" */,141 ),
	/* State 109 */ new Array( 35/* ")" */,-41 , 18/* "," */,-41 ),
	/* State 110 */ new Array( 20/* "=" */,142 , 17/* ";" */,-47 , 36/* "->" */,-47 , 19/* "." */,-47 , 34/* "(" */,-47 , 22/* "==" */,-47 , 29/* "<" */,-47 , 28/* ">" */,-47 , 26/* "<=" */,-47 , 27/* ">=" */,-47 , 23/* "!=" */,-47 , 31/* "-" */,-47 , 30/* "+" */,-47 , 33/* "*" */,-47 , 32/* "/" */,-47 , 7/* "RETURN" */,-47 , 39/* "Variable" */,-47 , 2/* "IF" */,-47 , 4/* "WHILE" */,-47 , 5/* "DO" */,-47 , 6/* "ECHO" */,-47 , 13/* "{" */,-47 , 15/* "[" */,-47 , 8/* "NewToken" */,-47 , 45/* "Identifier" */,-47 , 21/* "!" */,-47 , 41/* "String" */,-47 , 42/* "Integer" */,-47 , 43/* "Boolean" */,-47 , 44/* "Float" */,-47 , 35/* ")" */,-47 , 18/* "," */,-47 , 16/* "]" */,-47 ),
	/* State 111 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 35/* ")" */,-67 , 18/* "," */,-67 ),
	/* State 112 */ new Array( 34/* "(" */,89 , 17/* ";" */,-61 , 36/* "->" */,-61 , 19/* "." */,-61 , 22/* "==" */,-61 , 29/* "<" */,-61 , 28/* ">" */,-61 , 26/* "<=" */,-61 , 27/* ">=" */,-61 , 23/* "!=" */,-61 , 31/* "-" */,-61 , 30/* "+" */,-61 , 33/* "*" */,-61 , 32/* "/" */,-61 , 7/* "RETURN" */,-61 , 39/* "Variable" */,-61 , 2/* "IF" */,-61 , 4/* "WHILE" */,-61 , 5/* "DO" */,-61 , 6/* "ECHO" */,-61 , 13/* "{" */,-61 , 15/* "[" */,-61 , 8/* "NewToken" */,-61 , 45/* "Identifier" */,-61 , 21/* "!" */,-61 , 41/* "String" */,-61 , 42/* "Integer" */,-61 , 43/* "Boolean" */,-61 , 44/* "Float" */,-61 , 35/* ")" */,-61 , 18/* "," */,-61 , 16/* "]" */,-61 , 20/* "=" */,-61 ),
	/* State 113 */ new Array( 17/* ";" */,-62 , 36/* "->" */,-62 , 19/* "." */,-55 , 34/* "(" */,-62 , 22/* "==" */,-62 , 29/* "<" */,-62 , 28/* ">" */,-62 , 26/* "<=" */,-62 , 27/* ">=" */,-62 , 23/* "!=" */,-62 , 31/* "-" */,-62 , 30/* "+" */,-62 , 33/* "*" */,-62 , 32/* "/" */,-62 , 7/* "RETURN" */,-62 , 39/* "Variable" */,-62 , 2/* "IF" */,-62 , 4/* "WHILE" */,-62 , 5/* "DO" */,-62 , 6/* "ECHO" */,-62 , 13/* "{" */,-62 , 15/* "[" */,-62 , 8/* "NewToken" */,-62 , 45/* "Identifier" */,-62 , 21/* "!" */,-62 , 41/* "String" */,-62 , 42/* "Integer" */,-62 , 43/* "Boolean" */,-62 , 44/* "Float" */,-62 , 35/* ")" */,-62 , 18/* "," */,-62 , 16/* "]" */,-62 ),
	/* State 114 */ new Array( 19/* "." */,50 ),
	/* State 115 */ new Array( 19/* "." */,50 , 17/* ";" */,-75 , 22/* "==" */,-75 , 29/* "<" */,-75 , 28/* ">" */,-75 , 26/* "<=" */,-75 , 27/* ">=" */,-75 , 23/* "!=" */,-75 , 7/* "RETURN" */,-75 , 39/* "Variable" */,-75 , 2/* "IF" */,-75 , 4/* "WHILE" */,-75 , 5/* "DO" */,-75 , 6/* "ECHO" */,-75 , 13/* "{" */,-75 , 15/* "[" */,-75 , 34/* "(" */,-75 , 8/* "NewToken" */,-75 , 45/* "Identifier" */,-75 , 31/* "-" */,-75 , 21/* "!" */,-75 , 41/* "String" */,-75 , 42/* "Integer" */,-75 , 43/* "Boolean" */,-75 , 44/* "Float" */,-75 , 35/* ")" */,-75 , 18/* "," */,-75 , 30/* "+" */,-75 , 33/* "*" */,-75 , 32/* "/" */,-75 , 16/* "]" */,-75 , 36/* "->" */,-75 ),
	/* State 116 */ new Array( 19/* "." */,50 , 17/* ";" */,-74 , 22/* "==" */,-74 , 29/* "<" */,-74 , 28/* ">" */,-74 , 26/* "<=" */,-74 , 27/* ">=" */,-74 , 23/* "!=" */,-74 , 7/* "RETURN" */,-74 , 39/* "Variable" */,-74 , 2/* "IF" */,-74 , 4/* "WHILE" */,-74 , 5/* "DO" */,-74 , 6/* "ECHO" */,-74 , 13/* "{" */,-74 , 15/* "[" */,-74 , 34/* "(" */,-74 , 8/* "NewToken" */,-74 , 45/* "Identifier" */,-74 , 31/* "-" */,-74 , 21/* "!" */,-74 , 41/* "String" */,-74 , 42/* "Integer" */,-74 , 43/* "Boolean" */,-74 , 44/* "Float" */,-74 , 35/* ")" */,-74 , 18/* "," */,-74 , 30/* "+" */,-74 , 33/* "*" */,-74 , 32/* "/" */,-74 , 16/* "]" */,-74 , 36/* "->" */,-74 ),
	/* State 117 */ new Array( 19/* "." */,50 , 17/* ";" */,-73 , 22/* "==" */,-73 , 29/* "<" */,-73 , 28/* ">" */,-73 , 26/* "<=" */,-73 , 27/* ">=" */,-73 , 23/* "!=" */,-73 , 7/* "RETURN" */,-73 , 39/* "Variable" */,-73 , 2/* "IF" */,-73 , 4/* "WHILE" */,-73 , 5/* "DO" */,-73 , 6/* "ECHO" */,-73 , 13/* "{" */,-73 , 15/* "[" */,-73 , 34/* "(" */,-73 , 8/* "NewToken" */,-73 , 45/* "Identifier" */,-73 , 31/* "-" */,-73 , 21/* "!" */,-73 , 41/* "String" */,-73 , 42/* "Integer" */,-73 , 43/* "Boolean" */,-73 , 44/* "Float" */,-73 , 35/* ")" */,-73 , 18/* "," */,-73 , 30/* "+" */,-73 , 33/* "*" */,-73 , 32/* "/" */,-73 , 16/* "]" */,-73 , 36/* "->" */,-73 ),
	/* State 118 */ new Array( 19/* "." */,50 , 17/* ";" */,-72 , 22/* "==" */,-72 , 29/* "<" */,-72 , 28/* ">" */,-72 , 26/* "<=" */,-72 , 27/* ">=" */,-72 , 23/* "!=" */,-72 , 7/* "RETURN" */,-72 , 39/* "Variable" */,-72 , 2/* "IF" */,-72 , 4/* "WHILE" */,-72 , 5/* "DO" */,-72 , 6/* "ECHO" */,-72 , 13/* "{" */,-72 , 15/* "[" */,-72 , 34/* "(" */,-72 , 8/* "NewToken" */,-72 , 45/* "Identifier" */,-72 , 31/* "-" */,-72 , 21/* "!" */,-72 , 41/* "String" */,-72 , 42/* "Integer" */,-72 , 43/* "Boolean" */,-72 , 44/* "Float" */,-72 , 35/* ")" */,-72 , 18/* "," */,-72 , 30/* "+" */,-72 , 33/* "*" */,-72 , 32/* "/" */,-72 , 16/* "]" */,-72 , 36/* "->" */,-72 ),
	/* State 119 */ new Array( 19/* "." */,50 , 17/* ";" */,-71 , 22/* "==" */,-71 , 29/* "<" */,-71 , 28/* ">" */,-71 , 26/* "<=" */,-71 , 27/* ">=" */,-71 , 23/* "!=" */,-71 , 7/* "RETURN" */,-71 , 39/* "Variable" */,-71 , 2/* "IF" */,-71 , 4/* "WHILE" */,-71 , 5/* "DO" */,-71 , 6/* "ECHO" */,-71 , 13/* "{" */,-71 , 15/* "[" */,-71 , 34/* "(" */,-71 , 8/* "NewToken" */,-71 , 45/* "Identifier" */,-71 , 31/* "-" */,-71 , 21/* "!" */,-71 , 41/* "String" */,-71 , 42/* "Integer" */,-71 , 43/* "Boolean" */,-71 , 44/* "Float" */,-71 , 35/* ")" */,-71 , 18/* "," */,-71 , 30/* "+" */,-71 , 33/* "*" */,-71 , 32/* "/" */,-71 , 16/* "]" */,-71 , 36/* "->" */,-71 ),
	/* State 120 */ new Array( 19/* "." */,50 , 17/* ";" */,-70 , 22/* "==" */,-70 , 29/* "<" */,-70 , 28/* ">" */,-70 , 26/* "<=" */,-70 , 27/* ">=" */,-70 , 23/* "!=" */,-70 , 7/* "RETURN" */,-70 , 39/* "Variable" */,-70 , 2/* "IF" */,-70 , 4/* "WHILE" */,-70 , 5/* "DO" */,-70 , 6/* "ECHO" */,-70 , 13/* "{" */,-70 , 15/* "[" */,-70 , 34/* "(" */,-70 , 8/* "NewToken" */,-70 , 45/* "Identifier" */,-70 , 31/* "-" */,-70 , 21/* "!" */,-70 , 41/* "String" */,-70 , 42/* "Integer" */,-70 , 43/* "Boolean" */,-70 , 44/* "Float" */,-70 , 35/* ")" */,-70 , 18/* "," */,-70 , 30/* "+" */,-70 , 33/* "*" */,-70 , 32/* "/" */,-70 , 16/* "]" */,-70 , 36/* "->" */,-70 ),
	/* State 121 */ new Array( 18/* "," */,127 , 35/* ")" */,144 ),
	/* State 122 */ new Array( 45/* "Identifier" */,112 , 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 123 */ new Array( 17/* ";" */,-85 , 22/* "==" */,-85 , 29/* "<" */,-85 , 28/* ">" */,-85 , 26/* "<=" */,-85 , 27/* ">=" */,-85 , 23/* "!=" */,-85 , 31/* "-" */,-85 , 30/* "+" */,-85 , 33/* "*" */,-85 , 32/* "/" */,-85 , 19/* "." */,-85 , 7/* "RETURN" */,-85 , 39/* "Variable" */,-85 , 2/* "IF" */,-85 , 4/* "WHILE" */,-85 , 5/* "DO" */,-85 , 6/* "ECHO" */,-85 , 13/* "{" */,-85 , 15/* "[" */,-85 , 34/* "(" */,-85 , 8/* "NewToken" */,-85 , 45/* "Identifier" */,-85 , 21/* "!" */,-85 , 41/* "String" */,-85 , 42/* "Integer" */,-85 , 43/* "Boolean" */,-85 , 44/* "Float" */,-85 , 35/* ")" */,-85 , 18/* "," */,-85 , 16/* "]" */,-85 , 36/* "->" */,-85 ),
	/* State 124 */ new Array( 17/* ";" */,-81 , 22/* "==" */,-81 , 29/* "<" */,-81 , 28/* ">" */,-81 , 26/* "<=" */,-81 , 27/* ">=" */,-81 , 23/* "!=" */,-81 , 31/* "-" */,-81 , 30/* "+" */,-81 , 19/* "." */,-81 , 7/* "RETURN" */,-81 , 39/* "Variable" */,-81 , 2/* "IF" */,-81 , 4/* "WHILE" */,-81 , 5/* "DO" */,-81 , 6/* "ECHO" */,-81 , 13/* "{" */,-81 , 15/* "[" */,-81 , 34/* "(" */,-81 , 8/* "NewToken" */,-81 , 45/* "Identifier" */,-81 , 21/* "!" */,-81 , 41/* "String" */,-81 , 42/* "Integer" */,-81 , 43/* "Boolean" */,-81 , 44/* "Float" */,-81 , 35/* ")" */,-81 , 33/* "*" */,-81 , 32/* "/" */,-81 , 18/* "," */,-81 , 16/* "]" */,-81 , 36/* "->" */,-81 ),
	/* State 125 */ new Array( 17/* ";" */,-77 , 22/* "==" */,-77 , 29/* "<" */,-77 , 28/* ">" */,-77 , 26/* "<=" */,-77 , 27/* ">=" */,-77 , 23/* "!=" */,-77 , 19/* "." */,-77 , 7/* "RETURN" */,-77 , 39/* "Variable" */,-77 , 2/* "IF" */,-77 , 4/* "WHILE" */,-77 , 5/* "DO" */,-77 , 6/* "ECHO" */,-77 , 13/* "{" */,-77 , 15/* "[" */,-77 , 34/* "(" */,-77 , 8/* "NewToken" */,-77 , 45/* "Identifier" */,-77 , 31/* "-" */,-77 , 21/* "!" */,-77 , 41/* "String" */,-77 , 42/* "Integer" */,-77 , 43/* "Boolean" */,-77 , 44/* "Float" */,-77 , 35/* ")" */,-77 , 30/* "+" */,-77 , 18/* "," */,-77 , 33/* "*" */,-77 , 32/* "/" */,-77 , 16/* "]" */,-77 , 36/* "->" */,-77 ),
	/* State 126 */ new Array( 17/* ";" */,-50 , 19/* "." */,-50 , 7/* "RETURN" */,-50 , 39/* "Variable" */,-50 , 2/* "IF" */,-50 , 4/* "WHILE" */,-50 , 5/* "DO" */,-50 , 6/* "ECHO" */,-50 , 13/* "{" */,-50 , 15/* "[" */,-50 , 34/* "(" */,-50 , 8/* "NewToken" */,-50 , 45/* "Identifier" */,-50 , 31/* "-" */,-50 , 21/* "!" */,-50 , 41/* "String" */,-50 , 42/* "Integer" */,-50 , 43/* "Boolean" */,-50 , 44/* "Float" */,-50 , 35/* ")" */,-50 , 22/* "==" */,-50 , 29/* "<" */,-50 , 28/* ">" */,-50 , 26/* "<=" */,-50 , 27/* ">=" */,-50 , 23/* "!=" */,-50 , 18/* "," */,-50 , 30/* "+" */,-50 , 33/* "*" */,-50 , 32/* "/" */,-50 , 16/* "]" */,-50 , 36/* "->" */,-50 ),
	/* State 127 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 128 */ new Array( 17/* ";" */,-64 , 36/* "->" */,-64 , 19/* "." */,-64 , 34/* "(" */,-64 , 22/* "==" */,-64 , 29/* "<" */,-64 , 28/* ">" */,-64 , 26/* "<=" */,-64 , 27/* ">=" */,-64 , 23/* "!=" */,-64 , 31/* "-" */,-64 , 30/* "+" */,-64 , 33/* "*" */,-64 , 32/* "/" */,-64 , 7/* "RETURN" */,-64 , 39/* "Variable" */,-64 , 2/* "IF" */,-64 , 4/* "WHILE" */,-64 , 5/* "DO" */,-64 , 6/* "ECHO" */,-64 , 13/* "{" */,-64 , 15/* "[" */,-64 , 8/* "NewToken" */,-64 , 45/* "Identifier" */,-64 , 21/* "!" */,-64 , 41/* "String" */,-64 , 42/* "Integer" */,-64 , 43/* "Boolean" */,-64 , 44/* "Float" */,-64 , 35/* ")" */,-64 , 18/* "," */,-64 , 16/* "]" */,-64 ),
	/* State 129 */ new Array( 32/* "/" */,90 , 33/* "*" */,91 , 17/* ";" */,-80 , 22/* "==" */,-80 , 29/* "<" */,-80 , 28/* ">" */,-80 , 26/* "<=" */,-80 , 27/* ">=" */,-80 , 23/* "!=" */,-80 , 31/* "-" */,-80 , 30/* "+" */,-80 , 19/* "." */,-80 , 7/* "RETURN" */,-80 , 39/* "Variable" */,-80 , 2/* "IF" */,-80 , 4/* "WHILE" */,-80 , 5/* "DO" */,-80 , 6/* "ECHO" */,-80 , 13/* "{" */,-80 , 15/* "[" */,-80 , 34/* "(" */,-80 , 8/* "NewToken" */,-80 , 45/* "Identifier" */,-80 , 21/* "!" */,-80 , 41/* "String" */,-80 , 42/* "Integer" */,-80 , 43/* "Boolean" */,-80 , 44/* "Float" */,-80 , 35/* ")" */,-80 , 18/* "," */,-80 , 16/* "]" */,-80 , 36/* "->" */,-80 ),
	/* State 130 */ new Array( 34/* "(" */,130 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 , 39/* "Variable" */,80 , 15/* "[" */,27 , 45/* "Identifier" */,34 ),
	/* State 131 */ new Array( 32/* "/" */,90 , 33/* "*" */,91 , 17/* ";" */,-79 , 22/* "==" */,-79 , 29/* "<" */,-79 , 28/* ">" */,-79 , 26/* "<=" */,-79 , 27/* ">=" */,-79 , 23/* "!=" */,-79 , 31/* "-" */,-79 , 30/* "+" */,-79 , 19/* "." */,-79 , 7/* "RETURN" */,-79 , 39/* "Variable" */,-79 , 2/* "IF" */,-79 , 4/* "WHILE" */,-79 , 5/* "DO" */,-79 , 6/* "ECHO" */,-79 , 13/* "{" */,-79 , 15/* "[" */,-79 , 34/* "(" */,-79 , 8/* "NewToken" */,-79 , 45/* "Identifier" */,-79 , 21/* "!" */,-79 , 41/* "String" */,-79 , 42/* "Integer" */,-79 , 43/* "Boolean" */,-79 , 44/* "Float" */,-79 , 35/* ")" */,-79 , 18/* "," */,-79 , 16/* "]" */,-79 , 36/* "->" */,-79 ),
	/* State 132 */ new Array( 17/* ";" */,-84 , 22/* "==" */,-84 , 29/* "<" */,-84 , 28/* ">" */,-84 , 26/* "<=" */,-84 , 27/* ">=" */,-84 , 23/* "!=" */,-84 , 31/* "-" */,-84 , 30/* "+" */,-84 , 33/* "*" */,-84 , 32/* "/" */,-84 , 19/* "." */,-84 , 7/* "RETURN" */,-84 , 39/* "Variable" */,-84 , 2/* "IF" */,-84 , 4/* "WHILE" */,-84 , 5/* "DO" */,-84 , 6/* "ECHO" */,-84 , 13/* "{" */,-84 , 15/* "[" */,-84 , 34/* "(" */,-84 , 8/* "NewToken" */,-84 , 45/* "Identifier" */,-84 , 21/* "!" */,-84 , 41/* "String" */,-84 , 42/* "Integer" */,-84 , 43/* "Boolean" */,-84 , 44/* "Float" */,-84 , 35/* ")" */,-84 , 18/* "," */,-84 , 16/* "]" */,-84 , 36/* "->" */,-84 ),
	/* State 133 */ new Array( 17/* ";" */,-83 , 22/* "==" */,-83 , 29/* "<" */,-83 , 28/* ">" */,-83 , 26/* "<=" */,-83 , 27/* ">=" */,-83 , 23/* "!=" */,-83 , 31/* "-" */,-83 , 30/* "+" */,-83 , 33/* "*" */,-83 , 32/* "/" */,-83 , 19/* "." */,-83 , 7/* "RETURN" */,-83 , 39/* "Variable" */,-83 , 2/* "IF" */,-83 , 4/* "WHILE" */,-83 , 5/* "DO" */,-83 , 6/* "ECHO" */,-83 , 13/* "{" */,-83 , 15/* "[" */,-83 , 34/* "(" */,-83 , 8/* "NewToken" */,-83 , 45/* "Identifier" */,-83 , 21/* "!" */,-83 , 41/* "String" */,-83 , 42/* "Integer" */,-83 , 43/* "Boolean" */,-83 , 44/* "Float" */,-83 , 35/* ")" */,-83 , 18/* "," */,-83 , 16/* "]" */,-83 , 36/* "->" */,-83 ),
	/* State 134 */ new Array( 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 135 */ new Array( 19/* "." */,50 , 17/* ";" */,148 ),
	/* State 136 */ new Array( 19/* "." */,50 , 16/* "]" */,149 ),
	/* State 137 */ new Array( 19/* "." */,50 , 17/* ";" */,150 ),
	/* State 138 */ new Array( 20/* "=" */,-69 , 17/* ";" */,-69 , 19/* "." */,-69 , 15/* "[" */,-69 , 36/* "->" */,-69 , 34/* "(" */,-69 , 22/* "==" */,-69 , 29/* "<" */,-69 , 28/* ">" */,-69 , 26/* "<=" */,-69 , 27/* ">=" */,-69 , 23/* "!=" */,-69 , 31/* "-" */,-69 , 30/* "+" */,-69 , 33/* "*" */,-69 , 32/* "/" */,-69 , 7/* "RETURN" */,-69 , 39/* "Variable" */,-69 , 2/* "IF" */,-69 , 4/* "WHILE" */,-69 , 5/* "DO" */,-69 , 6/* "ECHO" */,-69 , 13/* "{" */,-69 , 8/* "NewToken" */,-69 , 45/* "Identifier" */,-69 , 21/* "!" */,-69 , 41/* "String" */,-69 , 42/* "Integer" */,-69 , 43/* "Boolean" */,-69 , 44/* "Float" */,-69 , 35/* ")" */,-69 , 18/* "," */,-69 , 16/* "]" */,-69 ),
	/* State 139 */ new Array( 14/* "}" */,153 , 10/* "PublicToken" */,156 , 12/* "ProtectedToken" */,157 , 11/* "PrivateToken" */,158 , 40/* "FunctionName" */,-12 ),
	/* State 140 */ new Array( 39/* "Variable" */,159 ),
	/* State 141 */ new Array( 13/* "{" */,160 ),
	/* State 142 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 143 */ new Array( 18/* "," */,127 , 35/* ")" */,162 ),
	/* State 144 */ new Array( 17/* ";" */,-49 , 19/* "." */,-49 , 7/* "RETURN" */,-49 , 39/* "Variable" */,-49 , 2/* "IF" */,-49 , 4/* "WHILE" */,-49 , 5/* "DO" */,-49 , 6/* "ECHO" */,-49 , 13/* "{" */,-49 , 15/* "[" */,-49 , 34/* "(" */,-49 , 8/* "NewToken" */,-49 , 45/* "Identifier" */,-49 , 31/* "-" */,-49 , 21/* "!" */,-49 , 41/* "String" */,-49 , 42/* "Integer" */,-49 , 43/* "Boolean" */,-49 , 44/* "Float" */,-49 , 35/* ")" */,-49 , 18/* "," */,-49 , 22/* "==" */,-49 , 29/* "<" */,-49 , 28/* ">" */,-49 , 26/* "<=" */,-49 , 27/* ">=" */,-49 , 23/* "!=" */,-49 , 30/* "+" */,-49 , 33/* "*" */,-49 , 32/* "/" */,-49 , 16/* "]" */,-49 , 36/* "->" */,-49 ),
	/* State 145 */ new Array( 19/* "." */,50 , 35/* ")" */,-65 , 18/* "," */,-65 ),
	/* State 146 */ new Array( 32/* "/" */,90 , 33/* "*" */,91 , 35/* ")" */,123 ),
	/* State 147 */ new Array( 47/* "ScriptEnd" */,-23 , 48/* "InternalNonScript" */,-23 , 38/* "//" */,-23 , 7/* "RETURN" */,-23 , 39/* "Variable" */,-23 , 2/* "IF" */,-23 , 4/* "WHILE" */,-23 , 5/* "DO" */,-23 , 6/* "ECHO" */,-23 , 13/* "{" */,-23 , 9/* "ClassToken" */,-23 , 40/* "FunctionName" */,-23 , 15/* "[" */,-23 , 34/* "(" */,-23 , 8/* "NewToken" */,-23 , 45/* "Identifier" */,-23 , 31/* "-" */,-23 , 21/* "!" */,-23 , 41/* "String" */,-23 , 42/* "Integer" */,-23 , 43/* "Boolean" */,-23 , 44/* "Float" */,-23 , 14/* "}" */,-23 , 3/* "ELSE" */,-23 ),
	/* State 148 */ new Array( 47/* "ScriptEnd" */,-25 , 48/* "InternalNonScript" */,-25 , 38/* "//" */,-25 , 7/* "RETURN" */,-25 , 39/* "Variable" */,-25 , 2/* "IF" */,-25 , 4/* "WHILE" */,-25 , 5/* "DO" */,-25 , 6/* "ECHO" */,-25 , 13/* "{" */,-25 , 9/* "ClassToken" */,-25 , 40/* "FunctionName" */,-25 , 15/* "[" */,-25 , 34/* "(" */,-25 , 8/* "NewToken" */,-25 , 45/* "Identifier" */,-25 , 31/* "-" */,-25 , 21/* "!" */,-25 , 41/* "String" */,-25 , 42/* "Integer" */,-25 , 43/* "Boolean" */,-25 , 44/* "Float" */,-25 , 14/* "}" */,-25 , 3/* "ELSE" */,-25 ),
	/* State 149 */ new Array( 20/* "=" */,-68 , 17/* ";" */,-68 , 19/* "." */,-68 , 15/* "[" */,-68 , 36/* "->" */,-68 , 34/* "(" */,-68 , 22/* "==" */,-68 , 29/* "<" */,-68 , 28/* ">" */,-68 , 26/* "<=" */,-68 , 27/* ">=" */,-68 , 23/* "!=" */,-68 , 31/* "-" */,-68 , 30/* "+" */,-68 , 33/* "*" */,-68 , 32/* "/" */,-68 , 7/* "RETURN" */,-68 , 39/* "Variable" */,-68 , 2/* "IF" */,-68 , 4/* "WHILE" */,-68 , 5/* "DO" */,-68 , 6/* "ECHO" */,-68 , 13/* "{" */,-68 , 8/* "NewToken" */,-68 , 45/* "Identifier" */,-68 , 21/* "!" */,-68 , 41/* "String" */,-68 , 42/* "Integer" */,-68 , 43/* "Boolean" */,-68 , 44/* "Float" */,-68 , 35/* ")" */,-68 , 18/* "," */,-68 , 16/* "]" */,-68 ),
	/* State 150 */ new Array( 47/* "ScriptEnd" */,-27 , 48/* "InternalNonScript" */,-27 , 38/* "//" */,-27 , 7/* "RETURN" */,-27 , 39/* "Variable" */,-27 , 2/* "IF" */,-27 , 4/* "WHILE" */,-27 , 5/* "DO" */,-27 , 6/* "ECHO" */,-27 , 13/* "{" */,-27 , 9/* "ClassToken" */,-27 , 40/* "FunctionName" */,-27 , 15/* "[" */,-27 , 34/* "(" */,-27 , 8/* "NewToken" */,-27 , 45/* "Identifier" */,-27 , 31/* "-" */,-27 , 21/* "!" */,-27 , 41/* "String" */,-27 , 42/* "Integer" */,-27 , 43/* "Boolean" */,-27 , 44/* "Float" */,-27 , 14/* "}" */,-27 , 3/* "ELSE" */,-27 ),
	/* State 151 */ new Array( 14/* "}" */,-6 , 10/* "PublicToken" */,-6 , 12/* "ProtectedToken" */,-6 , 11/* "PrivateToken" */,-6 , 40/* "FunctionName" */,-6 ),
	/* State 152 */ new Array( 14/* "}" */,-5 , 10/* "PublicToken" */,-5 , 12/* "ProtectedToken" */,-5 , 11/* "PrivateToken" */,-5 , 40/* "FunctionName" */,-5 ),
	/* State 153 */ new Array( 47/* "ScriptEnd" */,-4 , 48/* "InternalNonScript" */,-4 , 38/* "//" */,-4 , 7/* "RETURN" */,-4 , 39/* "Variable" */,-4 , 2/* "IF" */,-4 , 4/* "WHILE" */,-4 , 5/* "DO" */,-4 , 6/* "ECHO" */,-4 , 13/* "{" */,-4 , 9/* "ClassToken" */,-4 , 40/* "FunctionName" */,-4 , 15/* "[" */,-4 , 34/* "(" */,-4 , 8/* "NewToken" */,-4 , 45/* "Identifier" */,-4 , 31/* "-" */,-4 , 21/* "!" */,-4 , 41/* "String" */,-4 , 42/* "Integer" */,-4 , 43/* "Boolean" */,-4 , 44/* "Float" */,-4 , 14/* "}" */,-4 ),
	/* State 154 */ new Array( 39/* "Variable" */,163 ),
	/* State 155 */ new Array( 40/* "FunctionName" */,164 ),
	/* State 156 */ new Array( 39/* "Variable" */,-8 , 40/* "FunctionName" */,-11 ),
	/* State 157 */ new Array( 39/* "Variable" */,-9 , 40/* "FunctionName" */,-13 ),
	/* State 158 */ new Array( 39/* "Variable" */,-10 , 40/* "FunctionName" */,-14 ),
	/* State 159 */ new Array( 35/* ")" */,-40 , 18/* "," */,-40 ),
	/* State 160 */ new Array( 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 161 */ new Array( 19/* "." */,50 , 17/* ";" */,-36 , 7/* "RETURN" */,-36 , 39/* "Variable" */,-36 , 2/* "IF" */,-36 , 4/* "WHILE" */,-36 , 5/* "DO" */,-36 , 6/* "ECHO" */,-36 , 13/* "{" */,-36 , 15/* "[" */,-36 , 34/* "(" */,-36 , 8/* "NewToken" */,-36 , 45/* "Identifier" */,-36 , 31/* "-" */,-36 , 21/* "!" */,-36 , 41/* "String" */,-36 , 42/* "Integer" */,-36 , 43/* "Boolean" */,-36 , 44/* "Float" */,-36 , 36/* "->" */,-36 , 22/* "==" */,-36 , 29/* "<" */,-36 , 28/* ">" */,-36 , 26/* "<=" */,-36 , 27/* ">=" */,-36 , 23/* "!=" */,-36 , 30/* "+" */,-36 , 33/* "*" */,-36 , 32/* "/" */,-36 , 35/* ")" */,-36 , 18/* "," */,-36 , 16/* "]" */,-36 ),
	/* State 162 */ new Array( 17/* ";" */,-63 , 36/* "->" */,-63 , 19/* "." */,-63 , 34/* "(" */,-63 , 22/* "==" */,-63 , 29/* "<" */,-63 , 28/* ">" */,-63 , 26/* "<=" */,-63 , 27/* ">=" */,-63 , 23/* "!=" */,-63 , 31/* "-" */,-63 , 30/* "+" */,-63 , 33/* "*" */,-63 , 32/* "/" */,-63 , 7/* "RETURN" */,-63 , 39/* "Variable" */,-63 , 2/* "IF" */,-63 , 4/* "WHILE" */,-63 , 5/* "DO" */,-63 , 6/* "ECHO" */,-63 , 13/* "{" */,-63 , 15/* "[" */,-63 , 8/* "NewToken" */,-63 , 45/* "Identifier" */,-63 , 21/* "!" */,-63 , 41/* "String" */,-63 , 42/* "Integer" */,-63 , 43/* "Boolean" */,-63 , 44/* "Float" */,-63 , 35/* ")" */,-63 , 18/* "," */,-63 , 16/* "]" */,-63 , 20/* "=" */,-63 ),
	/* State 163 */ new Array( 17/* ";" */,166 , 20/* "=" */,167 ),
	/* State 164 */ new Array( 34/* "(" */,168 ),
	/* State 165 */ new Array( 14/* "}" */,169 , 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 166 */ new Array( 14/* "}" */,-17 , 10/* "PublicToken" */,-17 , 12/* "ProtectedToken" */,-17 , 11/* "PrivateToken" */,-17 , 40/* "FunctionName" */,-17 ),
	/* State 167 */ new Array( 39/* "Variable" */,54 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 15/* "[" */,27 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 168 */ new Array( 39/* "Variable" */,109 , 35/* ")" */,-42 , 18/* "," */,-42 ),
	/* State 169 */ new Array( 47/* "ScriptEnd" */,-15 , 48/* "InternalNonScript" */,-15 , 38/* "//" */,-15 , 7/* "RETURN" */,-15 , 39/* "Variable" */,-15 , 2/* "IF" */,-15 , 4/* "WHILE" */,-15 , 5/* "DO" */,-15 , 6/* "ECHO" */,-15 , 13/* "{" */,-15 , 9/* "ClassToken" */,-15 , 40/* "FunctionName" */,-15 , 15/* "[" */,-15 , 34/* "(" */,-15 , 8/* "NewToken" */,-15 , 45/* "Identifier" */,-15 , 31/* "-" */,-15 , 21/* "!" */,-15 , 41/* "String" */,-15 , 42/* "Integer" */,-15 , 43/* "Boolean" */,-15 , 44/* "Float" */,-15 , 14/* "}" */,-15 ),
	/* State 170 */ new Array( 19/* "." */,50 , 17/* ";" */,172 ),
	/* State 171 */ new Array( 18/* "," */,140 , 35/* ")" */,173 ),
	/* State 172 */ new Array( 14/* "}" */,-18 , 10/* "PublicToken" */,-18 , 12/* "ProtectedToken" */,-18 , 11/* "PrivateToken" */,-18 , 40/* "FunctionName" */,-18 ),
	/* State 173 */ new Array( 13/* "{" */,174 ),
	/* State 174 */ new Array( 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 175 */ new Array( 14/* "}" */,176 , 48/* "InternalNonScript" */,8 , 38/* "//" */,9 , 2/* "IF" */,13 , 4/* "WHILE" */,14 , 5/* "DO" */,15 , 6/* "ECHO" */,16 , 39/* "Variable" */,17 , 13/* "{" */,18 , 9/* "ClassToken" */,19 , 40/* "FunctionName" */,20 , 7/* "RETURN" */,21 , 15/* "[" */,27 , 8/* "NewToken" */,30 , 34/* "(" */,31 , 45/* "Identifier" */,34 , 31/* "-" */,37 , 21/* "!" */,38 , 41/* "String" */,40 , 42/* "Integer" */,41 , 43/* "Boolean" */,42 , 44/* "Float" */,43 ),
	/* State 176 */ new Array( 14/* "}" */,-16 , 10/* "PublicToken" */,-16 , 12/* "ProtectedToken" */,-16 , 11/* "PrivateToken" */,-16 , 40/* "FunctionName" */,-16 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 49/* PHPScript */,1 ),
	/* State 1 */ new Array( 50/* Script */,2 ),
	/* State 2 */ new Array(  ),
	/* State 3 */ new Array( 51/* Stmt */,4 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 4 */ new Array( 51/* Stmt */,44 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 5 */ new Array(  ),
	/* State 6 */ new Array(  ),
	/* State 7 */ new Array(  ),
	/* State 8 */ new Array(  ),
	/* State 9 */ new Array( 65/* AssertStmt */,46 ),
	/* State 10 */ new Array(  ),
	/* State 11 */ new Array(  ),
	/* State 12 */ new Array(  ),
	/* State 13 */ new Array( 60/* Expression */,52 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 14 */ new Array( 60/* Expression */,55 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 15 */ new Array( 63/* SingleStmt */,56 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 16 */ new Array( 60/* Expression */,57 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 17 */ new Array( 64/* ArrayIndices */,58 ),
	/* State 18 */ new Array( 51/* Stmt */,61 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 19 */ new Array(  ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array( 60/* Expression */,64 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array(  ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array(  ),
	/* State 26 */ new Array( 64/* ArrayIndices */,67 ),
	/* State 27 */ new Array(  ),
	/* State 28 */ new Array(  ),
	/* State 29 */ new Array(  ),
	/* State 30 */ new Array( 69/* FunctionInvoke */,75 , 66/* LValue */,76 , 72/* MemberAccess */,25 , 73/* VarVal */,77 , 74/* FunctionAccess */,78 , 67/* AttributeAccess */,79 ),
	/* State 31 */ new Array( 76/* MulDivExp */,81 , 75/* AddSubExp */,82 , 68/* BinaryExp */,83 , 60/* Expression */,84 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 77/* UnaryExp */,36 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 78/* Value */,39 , 72/* MemberAccess */,25 , 73/* VarVal */,26 ),
	/* State 32 */ new Array( 70/* ActualParameterList */,85 , 60/* Expression */,86 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 33 */ new Array(  ),
	/* State 34 */ new Array(  ),
	/* State 35 */ new Array(  ),
	/* State 36 */ new Array(  ),
	/* State 37 */ new Array( 78/* Value */,92 , 73/* VarVal */,26 , 66/* LValue */,93 , 72/* MemberAccess */,25 , 74/* FunctionAccess */,78 , 67/* AttributeAccess */,79 , 69/* FunctionInvoke */,32 ),
	/* State 38 */ new Array( 60/* Expression */,94 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 39 */ new Array(  ),
	/* State 40 */ new Array(  ),
	/* State 41 */ new Array(  ),
	/* State 42 */ new Array(  ),
	/* State 43 */ new Array(  ),
	/* State 44 */ new Array( 51/* Stmt */,44 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 45 */ new Array(  ),
	/* State 46 */ new Array(  ),
	/* State 47 */ new Array(  ),
	/* State 48 */ new Array(  ),
	/* State 49 */ new Array(  ),
	/* State 50 */ new Array( 60/* Expression */,96 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 51 */ new Array(  ),
	/* State 52 */ new Array( 63/* SingleStmt */,97 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 53 */ new Array(  ),
	/* State 54 */ new Array( 64/* ArrayIndices */,98 ),
	/* State 55 */ new Array( 63/* SingleStmt */,99 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 56 */ new Array(  ),
	/* State 57 */ new Array(  ),
	/* State 58 */ new Array(  ),
	/* State 59 */ new Array( 60/* Expression */,104 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 60 */ new Array( 60/* Expression */,105 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 61 */ new Array( 51/* Stmt */,44 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 62 */ new Array(  ),
	/* State 63 */ new Array( 58/* FormalParameterList */,108 ),
	/* State 64 */ new Array(  ),
	/* State 65 */ new Array(  ),
	/* State 66 */ new Array( 67/* AttributeAccess */,110 , 69/* FunctionInvoke */,111 , 71/* ExpressionNotFunAccess */,113 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 66/* LValue */,22 , 60/* Expression */,114 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 74/* FunctionAccess */,24 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 67 */ new Array(  ),
	/* State 68 */ new Array(  ),
	/* State 69 */ new Array( 60/* Expression */,115 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 70 */ new Array( 60/* Expression */,116 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 71 */ new Array( 60/* Expression */,117 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 72 */ new Array( 60/* Expression */,118 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 73 */ new Array( 60/* Expression */,119 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 74 */ new Array( 60/* Expression */,120 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 75 */ new Array( 70/* ActualParameterList */,121 , 60/* Expression */,86 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 76 */ new Array(  ),
	/* State 77 */ new Array( 64/* ArrayIndices */,67 ),
	/* State 78 */ new Array(  ),
	/* State 79 */ new Array(  ),
	/* State 80 */ new Array(  ),
	/* State 81 */ new Array(  ),
	/* State 82 */ new Array(  ),
	/* State 83 */ new Array(  ),
	/* State 84 */ new Array(  ),
	/* State 85 */ new Array(  ),
	/* State 86 */ new Array(  ),
	/* State 87 */ new Array( 76/* MulDivExp */,129 , 77/* UnaryExp */,36 , 78/* Value */,39 , 73/* VarVal */,26 , 66/* LValue */,93 , 72/* MemberAccess */,25 , 74/* FunctionAccess */,78 , 67/* AttributeAccess */,79 , 69/* FunctionInvoke */,32 ),
	/* State 88 */ new Array( 76/* MulDivExp */,131 , 77/* UnaryExp */,36 , 78/* Value */,39 , 73/* VarVal */,26 , 66/* LValue */,93 , 72/* MemberAccess */,25 , 74/* FunctionAccess */,78 , 67/* AttributeAccess */,79 , 69/* FunctionInvoke */,32 ),
	/* State 89 */ new Array(  ),
	/* State 90 */ new Array( 77/* UnaryExp */,132 , 78/* Value */,39 , 73/* VarVal */,26 , 66/* LValue */,93 , 72/* MemberAccess */,25 , 74/* FunctionAccess */,78 , 67/* AttributeAccess */,79 , 69/* FunctionInvoke */,32 ),
	/* State 91 */ new Array( 77/* UnaryExp */,133 , 78/* Value */,39 , 73/* VarVal */,26 , 66/* LValue */,93 , 72/* MemberAccess */,25 , 74/* FunctionAccess */,78 , 67/* AttributeAccess */,79 , 69/* FunctionInvoke */,32 ),
	/* State 92 */ new Array(  ),
	/* State 93 */ new Array(  ),
	/* State 94 */ new Array(  ),
	/* State 95 */ new Array(  ),
	/* State 96 */ new Array(  ),
	/* State 97 */ new Array(  ),
	/* State 98 */ new Array(  ),
	/* State 99 */ new Array(  ),
	/* State 100 */ new Array( 60/* Expression */,135 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 101 */ new Array(  ),
	/* State 102 */ new Array( 60/* Expression */,136 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 103 */ new Array( 60/* Expression */,137 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 104 */ new Array(  ),
	/* State 105 */ new Array(  ),
	/* State 106 */ new Array(  ),
	/* State 107 */ new Array( 52/* Member */,139 ),
	/* State 108 */ new Array(  ),
	/* State 109 */ new Array(  ),
	/* State 110 */ new Array(  ),
	/* State 111 */ new Array( 70/* ActualParameterList */,143 , 60/* Expression */,86 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 112 */ new Array(  ),
	/* State 113 */ new Array(  ),
	/* State 114 */ new Array(  ),
	/* State 115 */ new Array(  ),
	/* State 116 */ new Array(  ),
	/* State 117 */ new Array(  ),
	/* State 118 */ new Array(  ),
	/* State 119 */ new Array(  ),
	/* State 120 */ new Array(  ),
	/* State 121 */ new Array(  ),
	/* State 122 */ new Array( 69/* FunctionInvoke */,111 , 71/* ExpressionNotFunAccess */,113 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 60/* Expression */,114 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 74/* FunctionAccess */,24 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 123 */ new Array(  ),
	/* State 124 */ new Array(  ),
	/* State 125 */ new Array(  ),
	/* State 126 */ new Array(  ),
	/* State 127 */ new Array( 60/* Expression */,145 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 128 */ new Array(  ),
	/* State 129 */ new Array(  ),
	/* State 130 */ new Array( 76/* MulDivExp */,146 , 77/* UnaryExp */,36 , 78/* Value */,39 , 73/* VarVal */,26 , 66/* LValue */,93 , 72/* MemberAccess */,25 , 74/* FunctionAccess */,78 , 67/* AttributeAccess */,79 , 69/* FunctionInvoke */,32 ),
	/* State 131 */ new Array(  ),
	/* State 132 */ new Array(  ),
	/* State 133 */ new Array(  ),
	/* State 134 */ new Array( 63/* SingleStmt */,147 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 135 */ new Array(  ),
	/* State 136 */ new Array(  ),
	/* State 137 */ new Array(  ),
	/* State 138 */ new Array(  ),
	/* State 139 */ new Array( 55/* ClassFunctionDefinition */,151 , 54/* AttributeDefinition */,152 , 56/* AttributeMod */,154 , 57/* FunctionMod */,155 ),
	/* State 140 */ new Array(  ),
	/* State 141 */ new Array(  ),
	/* State 142 */ new Array( 60/* Expression */,161 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
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
	/* State 160 */ new Array( 51/* Stmt */,165 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 161 */ new Array(  ),
	/* State 162 */ new Array(  ),
	/* State 163 */ new Array(  ),
	/* State 164 */ new Array(  ),
	/* State 165 */ new Array( 51/* Stmt */,44 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 166 */ new Array(  ),
	/* State 167 */ new Array( 60/* Expression */,170 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 68/* BinaryExp */,28 , 62/* AssignmentStmt */,53 , 67/* AttributeAccess */,29 , 66/* LValue */,22 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 168 */ new Array( 58/* FormalParameterList */,171 ),
	/* State 169 */ new Array(  ),
	/* State 170 */ new Array(  ),
	/* State 171 */ new Array(  ),
	/* State 172 */ new Array(  ),
	/* State 173 */ new Array(  ),
	/* State 174 */ new Array( 51/* Stmt */,175 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 175 */ new Array( 51/* Stmt */,44 , 63/* SingleStmt */,5 , 53/* ClassDefinition */,6 , 59/* FunctionDefinition */,7 , 61/* Return */,10 , 62/* AssignmentStmt */,11 , 60/* Expression */,12 , 66/* LValue */,22 , 71/* ExpressionNotFunAccess */,23 , 74/* FunctionAccess */,24 , 72/* MemberAccess */,25 , 73/* VarVal */,26 , 68/* BinaryExp */,28 , 67/* AttributeAccess */,29 , 69/* FunctionInvoke */,32 , 75/* AddSubExp */,33 , 76/* MulDivExp */,35 , 77/* UnaryExp */,36 , 78/* Value */,39 ),
	/* State 176 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"PHPScript'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"IF" /* Terminal symbol */,
	"ELSE" /* Terminal symbol */,
	"WHILE" /* Terminal symbol */,
	"DO" /* Terminal symbol */,
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
	"-" /* Terminal symbol */,
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
	"ScriptBegin" /* Terminal symbol */,
	"ScriptEnd" /* Terminal symbol */,
	"InternalNonScript" /* Terminal symbol */,
	"PHPScript" /* Non-terminal symbol */,
	"Script" /* Non-terminal symbol */,
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
	"AssertStmt" /* Non-terminal symbol */,
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
	
	la = __NODEJS_lex( info );
	while( true )
	{
		act = 178;
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
		if( act == 178 )
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
			
			while( act == 178 && la != 79 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery\n" +
									"Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
									"Action: " + act + "\n\n" );
				if( la == -1 )
					info.offset++;
					
				while( act == 178 && sstack.length > 0 )
				{
					sstack.pop();
					vstack.pop();
					
					if( sstack.length == 0 )
						break;
						
					act = 178;
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == la )
						{
							act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
				}
				
				if( act != 178 )
					break;
				
				for( var i = 0; i < rsstack.length; i++ )
				{
					sstack.push( rsstack[i] );
					vstack.push( rvstack[i] );
				}
				
				la = __NODEJS_lex( info );
			}
			
			if( act == 178 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery failed, terminating parse process..." );
				break;
			}


			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tError recovery succeeded, continuing" );
		}
		
		/*
		if( act == 178 )
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
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 2:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 3:
	{
			
											execute( vstack[ vstack.length - 2 ] );
											if (vstack[ vstack.length - 1 ].length > 2) {
												var strNode = createNode( NODE_CONST, vstack[ vstack.length - 1 ].substring(2,vstack[ vstack.length - 1 ].length) );
												execute( createNode( NODE_OP, OP_ECHO, strNode ) );
											}
										
	}
	break;
	case 4:
	{
			
											pstate.curClass = vstack[ vstack.length - 4 ]+'::';
											pstate.classTable[vstack[ vstack.length - 4 ]] =
												createClass( MOD_PUBLIC, vstack[ vstack.length - 4 ], pstate.curAttrs, pstate.curFuns );
											pstate.curAttrs = [];
											pstate.curFuns = [];
											pstate.curClass = '';
										
	}
	break;
	case 5:
	{
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 6:
	{
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 7:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 8:
	{
		 rval = MOD_PUBLIC; 
	}
	break;
	case 9:
	{
		 rval = MOD_PROTECTED; 
	}
	break;
	case 10:
	{
		 rval = MOD_PRIVATE; 
	}
	break;
	case 11:
	{
		 rval = MOD_PUBLIC; 
	}
	break;
	case 12:
	{
		 rval = MOD_PUBLIC; 
	}
	break;
	case 13:
	{
		 rval = MOD_PROTECTED; 
	}
	break;
	case 14:
	{
		 rval = MOD_PRIVATE; 
	}
	break;
	case 15:
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
	case 16:
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
	case 17:
	{
		
											pstate.curAttrs[vstack[ vstack.length - 2 ]] = createMember( vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] );
										
	}
	break;
	case 18:
	{
		
											pstate.curAttrs[vstack[ vstack.length - 4 ]] = createMember( vstack[ vstack.length - 5 ], vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] );
										
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
		rval = vstack[ vstack.length - 2 ];
	}
	break;
	case 22:
	{
		 rval = createNode( NODE_OP, OP_IF, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 23:
	{
		 rval = createNode( NODE_OP, OP_IF_ELSE, vstack[ vstack.length - 4 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 24:
	{
		 rval = createNode( NODE_OP, OP_WHILE_DO, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
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
		 
											if (vstack[ vstack.length - 1 ].length > 4) {
												var strNode = createNode( NODE_CONST, vstack[ vstack.length - 1 ].substring(2,vstack[ vstack.length - 1 ].length-2) );
												rval = createNode( NODE_OP, OP_ECHO, strNode );
											}
										
	}
	break;
	case 34:
	{
		 rval = vstack[ vstack.length - 1 ]; 
	}
	break;
	case 35:
	{
		 rval = createNode( NODE_OP, OP_ASSIGN, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 36:
	{
		 rval = createNode( NODE_OP, OP_ATTR_ASSIGN, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 37:
	{
			
											if (phypeTestSuite && vstack[ vstack.length - 2 ] == "assertEcho") {
												pstate.assertion = createAssertion( ASS_ECHO, vstack[ vstack.length - 1 ] );
											}
										
	}
	break;
	case 38:
	{
		
											if (phypeTestSuite && vstack[ vstack.length - 1 ] == "assertFail") {
												pstate.assertion = createAssertion( ASS_FAIL, 0 );
											}
										
	}
	break;
	case 39:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 40:
	{
		
											pstate.curParams.push(
												createNode( NODE_CONST, vstack[ vstack.length - 1 ] ));
										
	}
	break;
	case 41:
	{
		
											pstate.curParams.push(
												createNode( NODE_CONST, vstack[ vstack.length - 1 ] ));
										
	}
	break;
	case 42:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 43:
	{
		
											// Create with dummy none node afterwards, so execution
											// will not halt valid sequence.
											rval = createNode( NODE_OP, OP_NONE,
													createNode( NODE_OP, OP_RETURN, vstack[ vstack.length - 1 ] ),
													createNode(NODE_OP, OP_NONE));
										
	}
	break;
	case 44:
	{
		
											// Create with dummy none node afterwards, so execution
											// will not halt valid sequence.
											rval = createNode( NODE_OP, OP_NONE,
													createNode( NODE_OP, OP_RETURN ),
													createNode(NODE_OP, OP_NONE));
										
	}
	break;
	case 45:
	{
		rval = vstack[ vstack.length - 1 ];
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
		 rval = createNode( NODE_OP, OP_OBJ_NEW, vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 50:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 51:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 52:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 53:
	{
		 rval = createNode( NODE_OP, OP_FETCH_ARR, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 54:
	{
		 rval = createNode(NODE_OP, OP_NEW_ARR ); 
	}
	break;
	case 55:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 56:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 57:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 58:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 59:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 60:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 61:
	{
		 rval = createNode( NODE_OP, OP_OBJ_FETCH, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 62:
	{
		 rval = createNode( NODE_OP, OP_OBJ_FETCH, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 63:
	{
		 rval = createNode( NODE_OP, OP_OBJ_FCALL, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 64:
	{
		 rval = createNode( NODE_OP, OP_FCALL, vstack[ vstack.length - 3 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 65:
	{
		 rval = createNode( NODE_OP, OP_PASS_PARAM, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 66:
	{
		 rval = createNode( NODE_OP, OP_PASS_PARAM, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 67:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 68:
	{
		 rval = createNode( NODE_OP, OP_ARR_KEYS_R, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 69:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 70:
	{
		 rval = createNode( NODE_OP, OP_EQU, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 71:
	{
		 rval = createNode( NODE_OP, OP_LOT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 72:
	{
		 rval = createNode( NODE_OP, OP_GRT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 73:
	{
		 rval = createNode( NODE_OP, OP_LOE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 74:
	{
		 rval = createNode( NODE_OP, OP_GRE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 75:
	{
		 rval = createNode( NODE_OP, OP_NEQ, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 76:
	{
		 rval = createNode( NODE_OP, OP_CONCAT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 77:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 78:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 79:
	{
		 rval = createNode( NODE_OP, OP_SUB, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 80:
	{
		 rval = createNode( NODE_OP, OP_ADD, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 81:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 82:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 83:
	{
		 rval = createNode( NODE_OP, OP_MUL, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 84:
	{
		 rval = createNode( NODE_OP, OP_DIV, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 85:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 86:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 87:
	{
		 rval = createNode( NODE_OP, OP_NEG, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 88:
	{
		 rval = createNode( NODE_OP, OP_BOOL_NEG, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 89:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 90:
	{
		 rval = createNode( NODE_VAR, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 91:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 92:
	{
		 rval = createNode( NODE_CONST, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 93:
	{
		 rval = createNode( NODE_INT, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 94:
	{
		 rval = createNode( NODE_INT, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 95:
	{
		 rval = createNode( NODE_FLOAT, vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 96:
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




//////////////////////
// PHYPE I/O-CHECKS //
//////////////////////
if (!phypeIn || phypeIn == 'undefined') {
	var phypeIn = function() {
		// Running from V8 or another shell JS-app
		if (typeof(alert) == 'undefined') {
			return '';
		}
		// Running from browser
		else
			return prompt( "Please enter a PHP-script to be executed:",
			//	"<? $a[1] = 'foo'; $foo = 'bar'; echo $a[1].$foo; ?>"
				//"<? $a=1; $b=2; $c=3; echo 'starting'; if ($a+$b == 3){ $r = $r + 1; if ($c-$b > 0) { $r = $r + 1; if ($c*$b < 7) {	$r = $r + 1; if ($c*$a+$c == 6) { $r = $r + 1; if ($c*$c/$b <= 5) echo $r; }}}} echo 'Done'; echo $r;?>"
				//"<? $a[0]['d'] = 'hej'; $a[0][1] = '!'; $b = $a; $c = $a; $b[0] = 'verden'; echo $a[0]['d']; echo $b[0]; echo $c[0][1]; echo $c[0]; echo $c; if ($c) { ?>C er sat<? } ?>"
				"<?" +
				"function get42() {" +
				"	return 42;" +
				"}" +
				"$crazy = 1*get42()-(get42()/2)+42-21;" +
				"echo $crazy;" +
				"?>"
			);
	};
}

// Set phypeOut if it is not set.
if (!phypeOut || phypeOut == 'undefined') {
	// Running from V8 or another shell JS-app
	if (typeof(alert) == 'undefined')
		var phypeOut = function() {};//print;
	else // Running from browser
		var phypeOut = alert;
}

/**
 * Creates an echo with non-PHP character data that precedes the first php-tag.
 */
function preParse(str) {
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
	
	if( ( error_cnt = __parse( preParse(str), error_off, error_la ) ) > 0 ) {
		for(var i=0; i<error_cnt; i++)
			phypeOut( "Parse error near >" 
				+ str.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"<br/>\n" );
	}
}

/////////////
// PARSING //
/////////////

// If we are not in our test suite, load all the scripts all at once.
if (!phypeTestSuite && !fromShell) {
	var str = phypeIn();
	
	interpret(str);

	if (phypeDoc && phypeDoc.open) {
		phypeDoc.close();
	}
}
// If we are, parse it accordingly
else if (phpScripts && !fromShell) {
	var phypeTestDoc;

	phypeTestDoc.write('<table style="border-collapse: collapse; border: 1px solid DarkRed; background-color: Bisque;">\n');
	phypeTestDoc.write('<tr>\n');
	phypeTestDoc.write('<th style="border-collapse: collapse; border: 1px solid DarkRed; background-color: Brown; color: Bisque;">Test case</th>\n');
	phypeTestDoc.write('<th style="border-collapse: collapse; border: 1px solid DarkRed; background-color: Brown; color: Bisque;">Time</th>\n');
	phypeTestDoc.write('<th style="border-collapse: collapse; border: 1px solid DarkRed; background-color: Brown; color: Bisque;">Status</th>\n');
	phypeTestDoc.write('</tr>\n');
	
	for (var i=0; i<phpScripts.length; i++) {
		var script = phpScripts[i];

		// HACK: It doesn't work unless we parse it once before our actual parse ...
		if (i>0) interpret( script.code );
		resetState();
		
		phypeEcho = '';
		
		var failed = false;
		var thrownException = null;
		var secs = 'Unknown';
		try {
			var begin = new Date();
			interpret(script.code);
			var end = new Date();
			secs = ((end.getTime() - begin.getTime())/1000)+" sec";
		} catch(exception) {
			failed = true;
			thrownException = exception;
		}
		
		if (pstate.assertion) {
			phypeTestDoc.write('<tr style="border-bottom: 1px solid gray;">\n');
			phypeTestDoc.writeTitle(script.name);
			phypeTestDoc.writeExecTime(secs);
			switch (pstate.assertion.type) {
				case ASS_ECHO:
 					if (thrownException)
						phypeTestDoc.writeStatus('fail', 'Thrown exception: '+thrownException);
					else if (phypeEcho != pstate.assertion.value) {
						phypeTestDoc.writeStatus('fail', 'Expected output: "'+pstate.assertion.value +
											'". Actual output: "'+phypeEcho+'".\n<br/>');
					} else {
						phypeTestDoc.writeStatus('pass', 'OK');
					}
					break;
				case ASS_FAIL:
					if (!failed)
						phypeTestDoc.writeStatus('fail','Expected script to fail,'+
								' but no exceptions were raised.<br/>\n<br/>\n');
					else {
						phypeTestDoc.writeStatus('pass', OK);
					}
					break;
			}
			pstate.assertion = null;
			phypeTestDoc.write('</tr>\n');
		}
	}
	phypeTestDoc.write('</table>\n');
	if (phypeTestDoc.open) {
		phypeTestDoc.write('Testing done!');
		phypeTestDoc.close();
	}
}

///////////////
// DEBUGGING //
///////////////
/**
 * Borrowed from http://snippets.dzone.com/posts/show/4296
 */
function var_dump(data,addwhitespace,safety,level) {
	var rtrn = '';
	var dt,it,spaces = '';
	if(!level) {level = 1;}
	for(var i=0; i<level; i++) {
		spaces += '   ';
	}//end for i<level
	if(typeof(data) != 'object') {
		dt = data;
		if(typeof(data) == 'string') {
			if(addwhitespace == 'html') {
				dt = dt.replace(/&/g,'&amp;');
				dt = dt.replace(/>/g,'&gt;');
				dt = dt.replace(/</g,'&lt;');
			}//end if addwhitespace == html
			dt = dt.replace(/\"/g,'\"');
			dt = '"' + dt + '"';
		}//end if typeof == string
		if(typeof(data) == 'function' && addwhitespace) {
			dt = new String(dt).replace(/\n/g,"<br/>"+spaces);
			if(addwhitespace == 'html') {
				dt = dt.replace(/&/g,'&amp;');
				dt = dt.replace(/>/g,'&gt;');
				dt = dt.replace(/</g,'&lt;');
			}//end if addwhitespace == html
		}//end if typeof == function
		if(typeof(data) == 'undefined') {
			dt = 'undefined';
		}//end if typeof == undefined
		if(addwhitespace == 'html') {
			if(typeof(dt) != 'string') {
				dt = new String(dt);
			}//end typeof != string
			dt = dt.replace(/ /g,"&nbsp;").replace(/\n/g,"<br/>");
		}//end if addwhitespace == html
		return dt;
	}//end if typeof != object && != array
	for (var x in data) {
		if(safety && (level > safety)) {
			dt = '*RECURSION*';
		} else {
			try {
			dt = var_dump(data[x],addwhitespace,safety,level+1);
			} catch (e) {continue;}
		}//end if-else level > safety
		it = var_dump(x,addwhitespace,safety,level+1);
		rtrn += it + ':' + dt + ',';
		if(addwhitespace) {
			rtrn += '<br/>'+spaces;
		}//end if addwhitespace
	}//end for...in
	if(addwhitespace) {
		rtrn = '{<br/>' + spaces + rtrn.substr(0,rtrn.length-(2+(level*3))) + '<br/>' +
					spaces.substr(0,spaces.length-3) + '}';
	} else {
		rtrn = '{' + rtrn.substr(0,rtrn.length-1) + '}';
	}//end if-else addwhitespace
	if(addwhitespace == 'html') {
		rtrn = rtrn.replace(/ /g,"&nbsp;").replace(/\n/g,"<br/>");
	}//end if addwhitespace == html
	return rtrn;
}

/**
 * Borrowed from http://ajaxcookbook.org/javascript-debug-log/
 */
function log(message) {
	if (!log.window_ || log.window_.closed) {
		var win = window.open("", null, "width=600,height=400," +
							"scrollbars=yes,resizable=yes,status=no," +
							"location=no,menubar=no,toolbar=no");
		if (!win) return;
		var doc = win.document;
		doc.write("<html><head><title>Debug Log</title></head>" +
				"<body></body></html>");
		doc.close();
		log.window_ = win;
	}
	var logLine = log.window_.document.createElement("div");
	logLine.appendChild(log.window_.document.createTextNode(message));
	log.window_.document.body.appendChild(logLine);
}

function var_log(variable) {
	log(var_dump(variable));
}

	var phypeOut = require("util").puts;
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
	
		if( ( error_cnt = __NODEJS_parse( preParse(str), error_off, error_la ) ) > 0 ) {
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

