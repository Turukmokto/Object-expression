function Const(x) {
    this.value = x;
}

Const.prototype.evaluate = function () {
    return this.value;
};
Const.prototype.toString = function () {
    return this.value.toString();
};
Const.ZERO = new Const(0);
Const.ONE = new Const(1);

Const.prototype.prefix = Const.prototype.toString;

const VAR_NAMES = {
    "x": 0,
    "y": 1,
    "z": 2
};

function Variable(name) {
    this.name = name;
    this.ind = VAR_NAMES[this.name];
}

Variable.prototype.evaluate = function (...args) {
    return args[this.ind];
};
Variable.prototype.toString = function () {
    return this.name;
};
Variable.prototype.prefix = Variable.prototype.toString;

const OperationPrototype = {
    evaluate: function (...args) {
        return this.operate(...this.getOp.map(x => x.evaluate.apply(x, args)));
    },

    toString: function () {
        return this.getOp.join(" ") + " " + this.getOpStr;
    },

    prefix: function () {
        return "(" + this.getOpStr + " " + this.getOp.map((op) => op.prefix()).join(" ") + ")";
    },
};

function Operation(...args) {
    this.getOp = args;
}

Operation.prototype = Object.create(OperationPrototype);

function MakeOperation(str, operate) {
    this.operate = operate;
    this.getOpStr = str;
}

MakeOperation.prototype = Operation.prototype;

function operationFactory(str, operate) {
    let result = function (...args) {
        Operation.apply(this, args);
    };
    result.prototype = new MakeOperation(str, operate);
    return result;
}

const Add = operationFactory(
    "+",
    (x, y) => x + y
);

const Subtract = operationFactory(
    "-",
    (x, y) => x - y
);

const Multiply = operationFactory(
    "*",
    (x, y) => x * y
);

const Divide = operationFactory(
    "/",
    (x, y) => x / y
);

const Negate = operationFactory(
    "negate",
    x => -x
);

const Med3 = operationFactory(
    "med3",
    (x, y, z) => [x, y, z].sort((x, y) => x - y)[1]
);

const Avg5 = operationFactory(
    "avg5",
    (a, b, c, d, e) => (a + b + c + d + e) / 5
);

const ArithMean = operationFactory(
    "arith-mean",
    (...args) => args.reduce((total, x) => total + x, 0) / args.length
);

const GeomMean = operationFactory(
    "geom-mean",
    (...args) => Math.pow(args.reduce((total, x) => total * Math.abs(x), 1), 1 / args.length)
);

const HarmMean = operationFactory(
    "harm-mean",
    (...args) => args.length / args.reduce((total, x) => total + 1 / x, 0)
);

const OPERATIONS = {
    "+": [Add, 2],
    "-": [Subtract, 2],
    "*": [Multiply, 2],
    "/": [Divide, 2],
    "negate": [Negate, 1],
    "med3": [Med3, 3],
    "avg5": [Avg5, 5],
    "arith-mean": [ArithMean, -1],
    "geom-mean": [GeomMean, -1],
    "harm-mean": [HarmMean, -1]
};

const VARIABLES = {};
Object.keys(VAR_NAMES).forEach((item) => VARIABLES[item] = new Variable(item));

function printPlace(s, index, len) {
    let result = s.split('');
    result.splice(Math.min(result.length, index), 0, "|-->");
    result.splice(Math.min(result.length, index + len + 1), 0, "<--|");
    return result.join('');
}

function exceptionFactory(name, createMessage) {
    let result = function (...args) {
        this.message = createMessage(...args);
    };
    result.prototype = Object.create(Error.prototype);
    result.prototype.name = name;
    return result;
}

const WrongOperandsQtyError = exceptionFactory(
    "WrongOperandsQtyError",
    (expr, operation, qty, startPos, endPos) =>
        "Wrong operands quantity for operation '" + operation
        + "': expected " + OPERATIONS[operation][1] + ", found " + qty
        + " at position: " + Number(startPos + 1) + "\n"
        + printPlace(expr, startPos, endPos - startPos)
);

const WrongBracketSequenceError = exceptionFactory(
    "WrongBracketSequenceError",
    (expr, pos, missing) => "Found wrong bracket sequence: "
        + (missing === ')' ? "expected closing bracket" : "closing bracket is redundant")
        + " at position: " + Number(pos + 1) + "\n"
        + printPlace(expr, pos, missing.length)
);

const UnknownLexemeError = exceptionFactory(
    "UnknownLexemeError",
    (expr, lexeme, pos) =>
        "Found unknown lexeme '" + lexeme + "' at position: " + Number(pos + 1)
        + '\n' + printPlace(expr, pos, lexeme.length)
);

const OperationNotFoundError = exceptionFactory(
    "OperationNotFoundError",
    (expr, pos, operation) =>
        "Expected operation after opening bracket, but found "
        + operation + " at position: " + Number(pos + 1)
        + '\n' + printPlace(expr, pos, operation.length)
);

const WrongEndingError = exceptionFactory(
    "WrongEndingError",
    (expr, pos) =>
        "Expected end of expression at position: " + Number(pos + 1)
        + '\n' + printPlace(expr, pos, expr.length - pos)
);

const WrongConstError = exceptionFactory(
    "WrongConstError",
    (expr, pos, got) =>
        "'" + got + "' is not a number at position: " + Number(pos + 1)
        + '\n' + printPlace(expr, pos, got.length)
);

const EmptyExpressionError = exceptionFactory(
    "EmptyExpressionError",
    (expr) => "Expression is empty:\n|-->" + expr + "<--|"
);


function parsePrefix(expression) {
    if (expression.length === 0) {
        throw new EmptyExpressionError(expression);
    }
    let currPos = 0;

    function skipWhitespaces() {
        while (currPos < expression.length && /\s/.test(expression.charAt(currPos))) {
            //console.log("in skip, currPos = " + currPos + ", curr = " + expression.charAt(currPos));
            ++currPos;
        }
    }

    let saveOperation = undefined;

    function getNextLexeme() {
        //console.log("===== in get next lexeme");
        if (saveOperation !== undefined) {
            let returnOperation = saveOperation;
            saveOperation = undefined;
            //console.log("===== got lexeme, saved operation, " + returnOperation);
            //console.log("currPos = " + currPos);
            return returnOperation;
        }

        skipWhitespaces();
        let startPos = currPos;
        if ("()".includes(expression.charAt(currPos))) {
            //console.log("===== got lexeme, found " + expression.charAt(currPos));
            //console.log("currPos = " + currPos);
            return expression.charAt(currPos++);
        }

        while (currPos < expression.length && !/[\s()]/.test(expression.charAt(currPos))) {
            ++currPos;
        }
        //console.log("===== got lexeme = " + expression.substring(startPos, currPos));
        //console.log("currPos = " + currPos);
        return expression.substring(startPos, currPos);
    }

    function getOperation() {
        //console.log("==== in get operation");
        let operation = getNextLexeme();
        //console.log("==== operation = " + operation);
        if (!(operation in OPERATIONS)) {
            throw new OperationNotFoundError(expression, currPos - operation.length, operation);
        }
        //console.log("==== end get operation");
        //console.log("currPos = " + currPos);
        return operation;
    }

    function getArgs(args, qty) {
        //console.log("=== in get args");
        for (let currQty = 0; (qty === -1 || currQty < qty) && currPos < expression.length; ++currQty) {
            let currLexeme = getNextLexeme();
            if (currLexeme === ")") {
                //console.log("=== got ), saved");
                saveOperation = currLexeme;
                break;
            }
            if (!(currLexeme in VAR_NAMES || currLexeme === "(" || !isNaN(Number(currLexeme)))) {
                //console.log("=== saved " + currLexeme);
                saveOperation = currLexeme;
                break;
            }
            args.push(analyze(currLexeme));
            //console.log("=== pushed " + args[args.length - 1]);
        }
        //console.log("=== end get args");
        //console.log("currPos = " + currPos);
    }

    function calculate(args) {
        //console.log("== in calculate");
        let operation = getOperation();
        getArgs(args, OPERATIONS[operation][1]);
        //console.log("== end calculate");
        //console.log("currPos = " + currPos);
        return operation;
    }

    function analyze(lexeme) {
        //console.log("= in analyze");
        //console.log("= lexeme = " + lexeme);
        if (lexeme === "(") {
            let args = [], startPos = currPos, operation = calculate(args);
            //console.log("= args = " + args);
            //console.log("= startPos = " + startPos);
            //console.log("= operation = " + operation);
            //console.log("= currPos = " + currPos);
            skipWhitespaces();
            let argsQty = OPERATIONS[operation][1];
            //console.log("= argsQty = " + argsQty);
            if (getNextLexeme() !== ")") {
                //console.log("= exception: " + currPos + " === )");
                throw new WrongBracketSequenceError(expression, currPos, ")");
            }
            if (argsQty > -1 && args.length !== argsQty) {
                currPos -= operation.length + 1;
                while (/\s/.test(expression.charAt(currPos))) {
                    --currPos;
                }
                throw new WrongOperandsQtyError(expression, operation, args.length, startPos, currPos + 1);
            }
            //console.log("= end analyze");
            //console.log("currPos = " + currPos);
            return new OPERATIONS[operation][0](...args);
        }

        if (lexeme in VAR_NAMES) {
            //console.log("= end analyze, VARIABLE");
            //console.log("currPos = " + currPos);
            return VARIABLES[lexeme];
        }

        if (/\d/.test(lexeme.charAt(0)) || lexeme.charAt(0) === "-") {
            //console.log("= end analyze, " + lexeme);
            //console.log("currPos = " + currPos);
            if (isNaN(Number(lexeme))) {
                throw new WrongConstError(expression, currPos - lexeme.length, lexeme);
            }
            return new Const(Number(lexeme));
        }

        throw new UnknownLexemeError(expression, lexeme, currPos - lexeme.length);
    }

    let result = analyze(getNextLexeme());
    skipWhitespaces();
    if (currPos !== expression.length) {
        throw new WrongEndingError(expression, currPos);
    }
    return result;
}