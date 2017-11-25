
import {
  FormatError, getLookupTableFactory, info, OPS, TextRenderingMode, warn
} from '../shared/util';
import { isCmd, isEOF } from './primitives';
import { Lexer, Parser } from './parser';
import { ColorSpace } from './colorspace';

var EvaluatorPreprocessor = (function EvaluatorPreprocessorClosure() {
  // Specifies properties for each command
  //
  // If variableArgs === true: [0, `numArgs`] expected
  // If variableArgs === false: exactly `numArgs` expected
  var getOPMap = getLookupTableFactory(function (t) {
    // Graphic state
    t['w'] = { id: OPS.setLineWidth, numArgs: 1, variableArgs: false, };
    t['J'] = { id: OPS.setLineCap, numArgs: 1, variableArgs: false, };
    t['j'] = { id: OPS.setLineJoin, numArgs: 1, variableArgs: false, };
    t['M'] = { id: OPS.setMiterLimit, numArgs: 1, variableArgs: false, };
    t['d'] = { id: OPS.setDash, numArgs: 2, variableArgs: false, };
    t['ri'] = { id: OPS.setRenderingIntent, numArgs: 1, variableArgs: false, };
    t['i'] = { id: OPS.setFlatness, numArgs: 1, variableArgs: false, };
    t['gs'] = { id: OPS.setGState, numArgs: 1, variableArgs: false, };
    t['q'] = { id: OPS.save, numArgs: 0, variableArgs: false, };
    t['Q'] = { id: OPS.restore, numArgs: 0, variableArgs: false, };
    t['cm'] = { id: OPS.transform, numArgs: 6, variableArgs: false, };

    // Path
    t['m'] = { id: OPS.moveTo, numArgs: 2, variableArgs: false, };
    t['l'] = { id: OPS.lineTo, numArgs: 2, variableArgs: false, };
    t['c'] = { id: OPS.curveTo, numArgs: 6, variableArgs: false, };
    t['v'] = { id: OPS.curveTo2, numArgs: 4, variableArgs: false, };
    t['y'] = { id: OPS.curveTo3, numArgs: 4, variableArgs: false, };
    t['h'] = { id: OPS.closePath, numArgs: 0, variableArgs: false, };
    t['re'] = { id: OPS.rectangle, numArgs: 4, variableArgs: false, };
    t['S'] = { id: OPS.stroke, numArgs: 0, variableArgs: false, };
    t['s'] = { id: OPS.closeStroke, numArgs: 0, variableArgs: false, };
    t['f'] = { id: OPS.fill, numArgs: 0, variableArgs: false, };
    t['F'] = { id: OPS.fill, numArgs: 0, variableArgs: false, };
    t['f*'] = { id: OPS.eoFill, numArgs: 0, variableArgs: false, };
    t['B'] = { id: OPS.fillStroke, numArgs: 0, variableArgs: false, };
    t['B*'] = { id: OPS.eoFillStroke, numArgs: 0, variableArgs: false, };
    t['b'] = { id: OPS.closeFillStroke, numArgs: 0, variableArgs: false, };
    t['b*'] = { id: OPS.closeEOFillStroke, numArgs: 0, variableArgs: false, };
    t['n'] = { id: OPS.endPath, numArgs: 0, variableArgs: false, };

    // Clipping
    t['W'] = { id: OPS.clip, numArgs: 0, variableArgs: false, };
    t['W*'] = { id: OPS.eoClip, numArgs: 0, variableArgs: false, };

    // Text
    t['BT'] = { id: OPS.beginText, numArgs: 0, variableArgs: false, };
    t['ET'] = { id: OPS.endText, numArgs: 0, variableArgs: false, };
    t['Tc'] = { id: OPS.setCharSpacing, numArgs: 1, variableArgs: false, };
    t['Tw'] = { id: OPS.setWordSpacing, numArgs: 1, variableArgs: false, };
    t['Tz'] = { id: OPS.setHScale, numArgs: 1, variableArgs: false, };
    t['TL'] = { id: OPS.setLeading, numArgs: 1, variableArgs: false, };
    t['Tf'] = { id: OPS.setFont, numArgs: 2, variableArgs: false, };
    t['Tr'] = { id: OPS.setTextRenderingMode, numArgs: 1,
      variableArgs: false, };
    t['Ts'] = { id: OPS.setTextRise, numArgs: 1, variableArgs: false, };
    t['Td'] = { id: OPS.moveText, numArgs: 2, variableArgs: false, };
    t['TD'] = { id: OPS.setLeadingMoveText, numArgs: 2, variableArgs: false, };
    t['Tm'] = { id: OPS.setTextMatrix, numArgs: 6, variableArgs: false, };
    t['T*'] = { id: OPS.nextLine, numArgs: 0, variableArgs: false, };
    t['Tj'] = { id: OPS.showText, numArgs: 1, variableArgs: false, };
    t['TJ'] = { id: OPS.showSpacedText, numArgs: 1, variableArgs: false, };
    t['\''] = { id: OPS.nextLineShowText, numArgs: 1, variableArgs: false, };
    t['"'] = { id: OPS.nextLineSetSpacingShowText, numArgs: 3,
      variableArgs: false, };

    // Type3 fonts
    t['d0'] = { id: OPS.setCharWidth, numArgs: 2, variableArgs: false, };
    t['d1'] = { id: OPS.setCharWidthAndBounds, numArgs: 6,
      variableArgs: false, };

    // Color
    t['CS'] = { id: OPS.setStrokeColorSpace, numArgs: 1, variableArgs: false, };
    t['cs'] = { id: OPS.setFillColorSpace, numArgs: 1, variableArgs: false, };
    t['SC'] = { id: OPS.setStrokeColor, numArgs: 4, variableArgs: true, };
    t['SCN'] = { id: OPS.setStrokeColorN, numArgs: 33, variableArgs: true, };
    t['sc'] = { id: OPS.setFillColor, numArgs: 4, variableArgs: true, };
    t['scn'] = { id: OPS.setFillColorN, numArgs: 33, variableArgs: true, };
    t['G'] = { id: OPS.setStrokeGray, numArgs: 1, variableArgs: false, };
    t['g'] = { id: OPS.setFillGray, numArgs: 1, variableArgs: false, };
    t['RG'] = { id: OPS.setStrokeRGBColor, numArgs: 3, variableArgs: false, };
    t['rg'] = { id: OPS.setFillRGBColor, numArgs: 3, variableArgs: false, };
    t['K'] = { id: OPS.setStrokeCMYKColor, numArgs: 4, variableArgs: false, };
    t['k'] = { id: OPS.setFillCMYKColor, numArgs: 4, variableArgs: false, };

    // Shading
    t['sh'] = { id: OPS.shadingFill, numArgs: 1, variableArgs: false, };

    // Images
    t['BI'] = { id: OPS.beginInlineImage, numArgs: 0, variableArgs: false, };
    t['ID'] = { id: OPS.beginImageData, numArgs: 0, variableArgs: false, };
    t['EI'] = { id: OPS.endInlineImage, numArgs: 1, variableArgs: false, };

    // XObjects
    t['Do'] = { id: OPS.paintXObject, numArgs: 1, variableArgs: false, };
    t['MP'] = { id: OPS.markPoint, numArgs: 1, variableArgs: false, };
    t['DP'] = { id: OPS.markPointProps, numArgs: 2, variableArgs: false, };
    t['BMC'] = { id: OPS.beginMarkedContent, numArgs: 1, variableArgs: false, };
    t['BDC'] = { id: OPS.beginMarkedContentProps, numArgs: 2,
      variableArgs: false, };
    t['EMC'] = { id: OPS.endMarkedContent, numArgs: 0, variableArgs: false, };

    // Compatibility
    t['BX'] = { id: OPS.beginCompat, numArgs: 0, variableArgs: false, };
    t['EX'] = { id: OPS.endCompat, numArgs: 0, variableArgs: false, };

    // (reserved partial commands for the lexer)
    t['BM'] = null;
    t['BD'] = null;
    t['true'] = null;
    t['fa'] = null;
    t['fal'] = null;
    t['fals'] = null;
    t['false'] = null;
    t['nu'] = null;
    t['nul'] = null;
    t['null'] = null;
  });

  function EvaluatorPreprocessor(stream, xref, stateManager) {
    this.opMap = getOPMap();
    // TODO(mduan): pass array of knownCommands rather than this.opMap
    // dictionary
    this.parser = new Parser(new Lexer(stream, this.opMap), false, xref);
    this.stateManager = stateManager;
    this.nonProcessedArgs = [];
  }

  EvaluatorPreprocessor.prototype = {
    get savedStatesDepth() {
      return this.stateManager.stateStack.length;
    },

    // |operation| is an object with two fields:
    //
    // - |fn| is an out param.
    //
    // - |args| is an inout param. On entry, it should have one of two values.
    //
    //   - An empty array. This indicates that the caller is providing the
    //     array in which the args will be stored in. The caller should use
    //     this value if it can reuse a single array for each call to read().
    //
    //   - |null|. This indicates that the caller needs this function to create
    //     the array in which any args are stored in. If there are zero args,
    //     this function will leave |operation.args| as |null| (thus avoiding
    //     allocations that would occur if we used an empty array to represent
    //     zero arguments). Otherwise, it will replace |null| with a new array
    //     containing the arguments. The caller should use this value if it
    //     cannot reuse an array for each call to read().
    //
    // These two modes are present because this function is very hot and so
    // avoiding allocations where possible is worthwhile.
    //
    read: function EvaluatorPreprocessor_read(operation) {
      var args = operation.args;
      while (true) {
        var obj = this.parser.getObj();
        if (isCmd(obj)) {
          var cmd = obj.cmd;
          // Check that the command is valid
          var opSpec = this.opMap[cmd];
          if (!opSpec) {
            warn('Unknown command "' + cmd + '"');
            continue;
          }

          var fn = opSpec.id;
          var numArgs = opSpec.numArgs;
          var argsLength = args !== null ? args.length : 0;

          if (!opSpec.variableArgs) {
            // Postscript commands can be nested, e.g. /F2 /GS2 gs 5.711 Tf
            if (argsLength !== numArgs) {
              var nonProcessedArgs = this.nonProcessedArgs;
              while (argsLength > numArgs) {
                nonProcessedArgs.push(args.shift());
                argsLength--;
              }
              while (argsLength < numArgs && nonProcessedArgs.length !== 0) {
                if (args === null) {
                  args = [];
                }
                args.unshift(nonProcessedArgs.pop());
                argsLength++;
              }
            }

            if (argsLength < numArgs) {
              // If we receive too few arguments, it's not possible to execute
              // the command, hence we skip the command.
              warn('Skipping command ' + fn + ': expected ' + numArgs +
                ' args, but received ' + argsLength + ' args.');
              if (args !== null) {
                args.length = 0;
              }
              continue;
            }
          } else if (argsLength > numArgs) {
            info('Command ' + fn + ': expected [0,' + numArgs +
              '] args, but received ' + argsLength + ' args.');
          }

          // TODO figure out how to type-check vararg functions
          this.preprocessCommand(fn, args);

          operation.fn = fn;
          operation.args = args;
          return true;
        }
        if (isEOF(obj)) {
          return false; // no more commands
        }
        // argument
        if (obj !== null) {
          if (args === null) {
            args = [];
          }
          args.push(obj);
          if (args.length > 33) {
            throw new FormatError('Too many arguments');
          }
        }
      }
    },

    preprocessCommand:
      function EvaluatorPreprocessor_preprocessCommand(fn, args) {
        switch (fn | 0) {
          case OPS.save:
            this.stateManager.save();
            break;
          case OPS.restore:
            this.stateManager.restore();
            break;
          case OPS.transform:
            this.stateManager.transform(args);
            break;
        }
      },
  };
  return EvaluatorPreprocessor;
})();

var CustomEvaluatorPreprocessor = (function() {

  function CustomEvaluatorPreprocessor(stream, xref, stateManager,
                                       resources) {
    EvaluatorPreprocessor.call(this, stream, xref, stateManager);
    this.resources = resources;
    this.xref = xref;

    // set initial color state
    var state = this.stateManager.state;
    state.textRenderingMode = TextRenderingMode.FILL;
    state.fillColorSpace = ColorSpace.singletons.gray;
    state.fillColor = [0, 0, 0];
  }

  CustomEvaluatorPreprocessor.prototype =
    Object.create(EvaluatorPreprocessor.prototype);

  CustomEvaluatorPreprocessor.prototype.preprocessCommand = function(fn, args) {
    EvaluatorPreprocessor.prototype.preprocessCommand.call(this, fn, args);
    var state = this.stateManager.state;
    switch (fn) {
      case OPS.setFillColorSpace:
        state.fillColorSpace =
          ColorSpace.parse(args[0], this.xref, this.resources);
        break;
      case OPS.setFillColor:
        var cs = state.fillColorSpace;
        state.fillColor = cs.getRgb(args, 0);
        break;
      case OPS.setFillGray:
        state.fillColorSpace = ColorSpace.singletons.gray;
        state.fillColor = ColorSpace.singletons.gray.getRgb(args, 0);
        break;
      case OPS.setFillCMYKColor:
        state.fillColorSpace = ColorSpace.singletons.cmyk;
        state.fillColor = ColorSpace.singletons.cmyk.getRgb(args, 0);
        break;
      case OPS.setFillRGBColor:
        state.fillColorSpace = ColorSpace.singletons.rgb;
        state.fillColor = ColorSpace.singletons.rgb.getRgb(args, 0);
        break;
      case OPS.setTextRenderingMode:
        state.textRenderingMode = args[0];
        break;
    }
  };

  return CustomEvaluatorPreprocessor;
})();

export {
  CustomEvaluatorPreprocessor,
};
