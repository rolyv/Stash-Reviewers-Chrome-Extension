(function () {
    // bitbucket page must have require function
    if (typeof window.define === 'undefined' || typeof window.require === 'undefined' || typeof window.bitbucket === 'undefined')
        return;

    // workaround to fix missing firefox onMessageExternal
    if (true || typeof window.chrome === 'undefined') {
        window.communication = {
            runtime: {
                sendMessage: function (extId, msg, callback) {
                    var randEventId = Math.floor((Math.random() * 1000) + 1);
                    msg.eventId = randEventId;
                    msg.extId = extId;
                    window.postMessage(msg, '*');
                    if (callback) {
                        window.addEventListener("message", function (eventArgs) {
                            if (eventArgs.data.identifier === randEventId)
                                callback(eventArgs.data.backgroundResult);
                        });
                    }
                }
            }
        };
    } else {
        window.communication = {
            runtime: {
                sendMessage: window.chrome.runtime.sendMessage
            }
        };
    }

    define('bitbucket-plugin/url', function () {
        function getSiteBaseURl() {
            return location.protocol + '//' + location.host;
        }

        function buildSlug(pageState) {
            if (pageState.links && pageState.links.self) {
                return pageState.links.self[0].href.replace(getSiteBaseURl(), '');
            }
            else return '';
        }

        return {
            getSiteBaseURl: getSiteBaseURl,
            buildSlug: buildSlug
        }
    });

    define('bitbucket-plugin/branch-details-page', [
        'aui',
        'aui/flag',
        'jquery',
        'lodash',
        'bitbucket/util/events',
        'bitbucket/util/state',
        'bitbucket-plugin/url'
    ], function (AJS,
                 auiFlag,
                 jQuery,
                 _,
                 events,
                 pageState,
                 urlUtil) {
        'use strict';
        function addCheckoutLink(branchId) {
            var project = pageState.getProject();
            var repository = pageState.getRepository();
            var ref = pageState.getRef();

            if (!project) {
                console.info('no project for checkout dropdown');
                return;
            }

            var cloneUrl;
            var repoName = repository.name;
            var branchOrigin = branchId || ref.displayId;
            var remoteName = project.owner ? project.owner.slug : project.name;

            // remove previous
            jQuery('.checkoutCommand_link').unbind('click');
            jQuery('#checkoutLink').remove();

            if (!repository.links.clone) {
                var $link = jQuery(['<a id="s2id_ddCheckoutCommand" href="#ddCheckoutCommand" aria-owns="ddCheckoutCommand" aria-haspopup="true" class="aui-button aui-style-default aui-dropdown2-trigger">',
                    '<span class="aui-icon aui-icon-small aui-iconfont-devtools-checkout"></span> ',
                    '<span class="name" title="copy git checkout cmmands to paste to terminal">Checkout</span> ',
                    '</a>',
                    '<div id="ddCheckoutCommand" class="aui-style-default aui-dropdown2">',
                    '	<ul class="aui-list-truncate">',
                    '		<li data-action=""><a href="javascript:void(0)" class="checkoutCommand_link" id="nothing">Sorry you don\'t have clone permission</a></li>',
                    '	</ul>',
                    '</div>'].join('\n'));
                jQuery('#branch-actions').parent().parent().append($link);
                return;
            }

            repository.links.clone.forEach(function (clone) {
                if (clone.name === 'ssh') {
                    cloneUrl = clone.href;
                }
            });

            if (!cloneUrl) {
                cloneUrl = repository.links.clone[0].href;
            }

            var $link = jQuery(['<a id="s2id_ddCheckoutCommand" href="#ddCheckoutCommand" aria-owns="ddCheckoutCommand" aria-haspopup="true" class="aui-button aui-style-default aui-dropdown2-trigger">',
                '<span class="aui-icon aui-icon-small aui-iconfont-devtools-checkout"></span> ',
                '<span class="name" title="copy git checkout cmmands to paste to terminal">Checkout</span> ',
                '</a>',
                '<div id="ddCheckoutCommand" class="aui-style-default aui-dropdown2">',
                '	<ul class="aui-list-truncate">',
                '		<li data-action="clone"><a href="javascript:void(0)" class="checkoutCommand_link" id="cloneCommand">Clone</a></li>',
                '		<li data-action="newremote"><a href="javascript:void(0)" class="checkoutCommand_link" id="remoteCommand">Add remote</a></li>',
                '		<li data-action="newremotenewbranch"><a href="javascript:void(0)" class="checkoutCommand_link">Add remote/Create branch</a></li>',
                '		<li data-action="newbranch"><a href="javascript:void(0)" class="checkoutCommand_link">Create branch</a></li>',
                '		<li data-action="checkout"><a href="javascript:void(0)" class="checkoutCommand_link">Checkout existing</a></li>',
                '	</ul>',
                '</div>'].join('\n'));

            // git remote naming
            (window.repoMapArray || []).forEach(function (map) {
                if (map.repo === remoteName) {
                    remoteName = map.remote;
                }
            });

            // git commands
            var cloneCommand = 'git clone ' + cloneUrl + ' ' + repoName + '_' + remoteName;
            var addOriginCommand = 'git remote add ' + remoteName + ' ' + cloneUrl;
            var fetchCommand = 'git fetch ' + remoteName;
            var checkoutNewCommand = 'git checkout --track ' + remoteName + '/' + branchOrigin;
            var checkoutCommand = 'git checkout ' + branchOrigin;

            var command = '';
            var ddlClicked = false;

            var $wrapperdiv = jQuery('<div></div>', {id: 'checkoutLink', style: 'float: left'});
            $wrapperdiv.append($link);
            jQuery('#branch-actions').parent().parent().append($wrapperdiv);
            jQuery('.checkoutCommand_link').click(function (e) {
                ddlClicked = true;
                var action = jQuery(e.target).data('action') || jQuery(e.target).parent().data('action');
                switch (action) {
                    case 'clone':
                        command = cloneCommand;
                        document.execCommand('copy');
                        break;
                    case 'newremote':
                        command = addOriginCommand + '; ' + fetchCommand + ';';
                        document.execCommand('copy');
                        break;
                    case 'newremotenewbranch':
                        command = addOriginCommand + '; ' + fetchCommand + '; ' + checkoutNewCommand;
                        document.execCommand('copy');
                        break;
                    case 'newbranch':
                        command = fetchCommand + '; ' + checkoutNewCommand;
                        document.execCommand('copy');
                        break;
                    case 'checkout':
                        command = fetchCommand + '; ' + checkoutCommand;
                        document.execCommand('copy');
                        break;
                    default:
                        break;
                }
            });

            jQuery('#cloneCommand').append(' (<span style="font-size:xx-small">' + repoName + '_' + remoteName + '</span>)');
            jQuery('#remoteCommand').append(' (<span style="font-size:xx-small">' + remoteName + '</span>)');


            jQuery(document).on('copy', function (e) {
                if (ddlClicked) {
                    e.preventDefault();
                    if (e.originalEvent.clipboardData) {
                        e.originalEvent.clipboardData.setData('text/plain', command);
                        auiFlag({
                            type: 'info',
                            title: 'Command copied!',
                            body: 'just paste it in your terminal.',
                            close: 'auto'
                        });
                    }
                    else if (window.clipboardData) {
                        auiFlag({
                            type: 'info',
                            title: 'Sorry copy api is not available!',
                            body: 'Try to update your browser.',
                            close: 'auto'
                        });
                    }

                    ddlClicked = false;
                }
            });
        }

        //////////////////////////////////////////////////// Display PRs status on branch page
        function loadPRStickers(branchRefId) {
            var project = pageState.getProject();
            var repository = pageState.getRepository();
            var ref = pageState.getRef();
            var branchId = branchRefId || ref.id;
            if (!project || !project.links) {
                console.info('no project link');
                return;
            }
            var projectUrl = urlUtil.buildSlug(project);
            var repoUrl = "repos/" + repository.slug;

            if (!ref || !ref.repository || !ref.repository.origin) {
                console.info('no repository origin');
                return;
            }

            // get project origin from ref and get PR with branch name
            var projectOriginUrl = urlUtil.buildSlug(ref.repository.origin).replace('/browse', '');
            projectOriginUrl = projectUrl + '/' + repoUrl;

            var getPRs = function (from, size, projectOriginUrl, fqBranchName) {
                var prApiUrl = '/rest/api/1.0' + projectOriginUrl + '/pull-requests?direction=OUTGOING&at=' + fqBranchName + '&state=ALL&start=' + from + '&limit=' + size;
                return jQuery.get(prApiUrl);
            };

            var searchPrs = function (from, size, projectOriginUrl, fqBranchName) {
                var deferred = jQuery.Deferred();
                var prList = [];
                getPRs(from, size, projectOriginUrl, fqBranchName).done(function (pullRequests) {
                    prList = pullRequests.values;

                    if (!pullRequests.isLastPage) {
                        searchPrs(from + size, size, projectOriginUrl, fqBranchName).done(function (list) {
                            if (list.length > 0) {
                                jQuery.merge(prList, list);
                            }

                            deferred.resolve(prList);
                        });
                    }
                    else {
                        deferred.resolve(prList);
                    }

                });

                return deferred.promise();
            };

            searchPrs(0, 20, projectOriginUrl, branchId).done(function (prs) {
                var mergedClass = 'aui-lozenge-success';
                var openClass = 'aui-lozenge-complete';
                var declinedClass = 'aui-lozenge-error';

                var $wrapper = jQuery('<div id="pr-status-wrapper" style="display: inline-block"></div>');
                jQuery('#pr-status-wrapper').remove();
                jQuery('.aui-toolbar2-secondary').prepend($wrapper);

                prs.forEach(function (pr) {
                    var commentsCount = (pr.properties && pr.properties.commentCount) ? pr.properties.commentCount : 0;
                    var resolvedTaskCount = (pr.properties && pr.properties.resolvedTaskCount) ? pr.properties.resolvedTaskCount : 0;
                    var openTaskCount = (pr.properties && pr.properties.openTaskCount) ? parseInt(pr.properties.openTaskCount) + parseInt(resolvedTaskCount) : 0;
                    var dest = pr.toRef ? pr.toRef.displayId : '';

                    var title = 'branch: ' + dest + ' | comments: ' + commentsCount + ' | tasks: ' + resolvedTaskCount + ' / ' + openTaskCount + ' | PR: ' + pr.title;
                    var $a = jQuery('<a>', {
                        text: pr.state,
                        title: title,
                        href: urlUtil.buildSlug(pr),
                        class: 'aui-lozenge declined aui-lozenge-subtle pull-request-list-trigger pull-request-state-lozenge'
                    });
                    if (pr.state === 'OPEN') {
                        $a.addClass(openClass);
                    }
                    else if (pr.state === 'MERGED') {
                        $a.addClass(mergedClass);
                    }
                    else if (pr.state === 'DECLINED') {
                        $a.addClass(declinedClass);
                    }

                    $a.css('margin-left', '6px');

                    $wrapper.append($a);

                    jQuery("#pr-status-wrapper").find('a').tooltip();
                });
            });
        }

        function addForkOriginLink(branchRefId) {
            var repository = pageState.getRepository();
            if (repository && repository.origin && repository.origin.links) {
                var $link = jQuery('<a style="font-size: small;margin-left:10px;">forked from ' + repository.origin.project.key + '/' + repository.origin.name + '</a>').attr('href', urlUtil.buildSlug(repository.origin));
                jQuery('h2.page-panel-content-header').append($link);
            }
        }

        return {
            loadPRStickers: loadPRStickers,
            addForkOriginLink: addForkOriginLink,
            addCheckoutLink: addCheckoutLink
        }
    });

    define('parser', [],
        (function () {
            "use strict";

            function peg$subclass(child, parent) {
                function ctor() {
                    this.constructor = child;
                }

                ctor.prototype = parent.prototype;
                child.prototype = new ctor();
            }

            function peg$SyntaxError(message, expected, found, location) {
                this.message = message;
                this.expected = expected;
                this.found = found;
                this.location = location;
                this.name = "SyntaxError";

                if (typeof Error.captureStackTrace === "function") {
                    Error.captureStackTrace(this, peg$SyntaxError);
                }
            }

            peg$subclass(peg$SyntaxError, Error);

            peg$SyntaxError.buildMessage = function (expected, found) {
                var DESCRIBE_EXPECTATION_FNS = {
                    literal: function (expectation) {
                        return "\"" + literalEscape(expectation.text) + "\"";
                    },

                    "class": function (expectation) {
                        var escapedParts = "",
                            i;

                        for (i = 0; i < expectation.parts.length; i++) {
                            escapedParts += expectation.parts[i] instanceof Array
                                ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
                                : classEscape(expectation.parts[i]);
                        }

                        return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
                    },

                    any: function (expectation) {
                        return "any character";
                    },

                    end: function (expectation) {
                        return "end of input";
                    },

                    other: function (expectation) {
                        return expectation.description;
                    }
                };

                function hex(ch) {
                    return ch.charCodeAt(0).toString(16).toUpperCase();
                }

                function literalEscape(s) {
                    return s
                        .replace(/\\/g, '\\\\')
                        .replace(/"/g, '\\"')
                        .replace(/\0/g, '\\0')
                        .replace(/\t/g, '\\t')
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r')
                        .replace(/[\x00-\x0F]/g, function (ch) {
                            return '\\x0' + hex(ch);
                        })
                        .replace(/[\x10-\x1F\x7F-\x9F]/g, function (ch) {
                            return '\\x' + hex(ch);
                        });
                }

                function classEscape(s) {
                    return s
                        .replace(/\\/g, '\\\\')
                        .replace(/\]/g, '\\]')
                        .replace(/\^/g, '\\^')
                        .replace(/-/g, '\\-')
                        .replace(/\0/g, '\\0')
                        .replace(/\t/g, '\\t')
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r')
                        .replace(/[\x00-\x0F]/g, function (ch) {
                            return '\\x0' + hex(ch);
                        })
                        .replace(/[\x10-\x1F\x7F-\x9F]/g, function (ch) {
                            return '\\x' + hex(ch);
                        });
                }

                function describeExpectation(expectation) {
                    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
                }

                function describeExpected(expected) {
                    var descriptions = new Array(expected.length),
                        i, j;

                    for (i = 0; i < expected.length; i++) {
                        descriptions[i] = describeExpectation(expected[i]);
                    }

                    descriptions.sort();

                    if (descriptions.length > 0) {
                        for (i = 1, j = 1; i < descriptions.length; i++) {
                            if (descriptions[i - 1] !== descriptions[i]) {
                                descriptions[j] = descriptions[i];
                                j++;
                            }
                        }
                        descriptions.length = j;
                    }

                    switch (descriptions.length) {
                        case 1:
                            return descriptions[0];

                        case 2:
                            return descriptions[0] + " or " + descriptions[1];

                        default:
                            return descriptions.slice(0, -1).join(", ")
                                + ", or "
                                + descriptions[descriptions.length - 1];
                    }
                }

                function describeFound(found) {
                    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
                }

                return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
            };

            function peg$parse(input, options) {
                options = options !== void 0 ? options : {};

                var peg$FAILED = {},

                    peg$startRuleFunctions = {Expression: peg$parseExpression},
                    peg$startRuleFunction = peg$parseExpression,

                    peg$c0 = "+",
                    peg$c1 = peg$literalExpectation("+", false),
                    peg$c2 = function (head, tail) {
                        var result = head, i;

                        for (i = 0; i < tail.length; i++) {
                            if (tail[i][1] === "+") {
                                result = result.concat(tail[i][3]);
                            }
                        }

                        return result;
                    },
                    peg$c3 = "random",
                    peg$c4 = peg$literalExpectation("random", false),
                    peg$c5 = "(",
                    peg$c6 = peg$literalExpectation("(", false),
                    peg$c7 = ",",
                    peg$c8 = peg$literalExpectation(",", false),
                    peg$c9 = ")",
                    peg$c10 = peg$literalExpectation(")", false),
                    peg$c11 = function (group, num) {
                        return random(group, num);
                    },
                    peg$c12 = peg$otherExpectation("string"),
                    peg$c13 = /^[a-zA-Z0-9]/,
                    peg$c14 = peg$classExpectation([["a", "z"], ["A", "Z"], ["0", "9"]], false, false),
                    peg$c15 = function () {
                        return jsonGroups[text()];
                    },
                    peg$c16 = peg$otherExpectation("integer"),
                    peg$c17 = /^[0-9]/,
                    peg$c18 = peg$classExpectation([["0", "9"]], false, false),
                    peg$c19 = function () {
                        return parseInt(text(), 10);
                    },
                    peg$c20 = peg$otherExpectation("whitespace"),
                    peg$c21 = /^[ \t\n\r]/,
                    peg$c22 = peg$classExpectation([" ", "\t", "\n", "\r"], false, false),

                    peg$currPos = 0,
                    peg$savedPos = 0,
                    peg$posDetailsCache = [{line: 1, column: 1}],
                    peg$maxFailPos = 0,
                    peg$maxFailExpected = [],
                    peg$silentFails = 0,

                    peg$result;

                if ("startRule" in options) {
                    if (!(options.startRule in peg$startRuleFunctions)) {
                        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
                    }

                    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
                }

                function text() {
                    return input.substring(peg$savedPos, peg$currPos);
                }

                function location() {
                    return peg$computeLocation(peg$savedPos, peg$currPos);
                }

                function expected(description, location) {
                    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

                    throw peg$buildStructuredError(
                        [peg$otherExpectation(description)],
                        input.substring(peg$savedPos, peg$currPos),
                        location
                    );
                }

                function error(message, location) {
                    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

                    throw peg$buildSimpleError(message, location);
                }

                function peg$literalExpectation(text, ignoreCase) {
                    return {type: "literal", text: text, ignoreCase: ignoreCase};
                }

                function peg$classExpectation(parts, inverted, ignoreCase) {
                    return {type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase};
                }

                function peg$anyExpectation() {
                    return {type: "any"};
                }

                function peg$endExpectation() {
                    return {type: "end"};
                }

                function peg$otherExpectation(description) {
                    return {type: "other", description: description};
                }

                function peg$computePosDetails(pos) {
                    var details = peg$posDetailsCache[pos], p;

                    if (details) {
                        return details;
                    } else {
                        p = pos - 1;
                        while (!peg$posDetailsCache[p]) {
                            p--;
                        }

                        details = peg$posDetailsCache[p];
                        details = {
                            line: details.line,
                            column: details.column
                        };

                        while (p < pos) {
                            if (input.charCodeAt(p) === 10) {
                                details.line++;
                                details.column = 1;
                            } else {
                                details.column++;
                            }

                            p++;
                        }

                        peg$posDetailsCache[pos] = details;
                        return details;
                    }
                }

                function peg$computeLocation(startPos, endPos) {
                    var startPosDetails = peg$computePosDetails(startPos),
                        endPosDetails = peg$computePosDetails(endPos);

                    return {
                        start: {
                            offset: startPos,
                            line: startPosDetails.line,
                            column: startPosDetails.column
                        },
                        end: {
                            offset: endPos,
                            line: endPosDetails.line,
                            column: endPosDetails.column
                        }
                    };
                }

                function peg$fail(expected) {
                    if (peg$currPos < peg$maxFailPos) {
                        return;
                    }

                    if (peg$currPos > peg$maxFailPos) {
                        peg$maxFailPos = peg$currPos;
                        peg$maxFailExpected = [];
                    }

                    peg$maxFailExpected.push(expected);
                }

                function peg$buildSimpleError(message, location) {
                    return new peg$SyntaxError(message, null, null, location);
                }

                function peg$buildStructuredError(expected, found, location) {
                    return new peg$SyntaxError(
                        peg$SyntaxError.buildMessage(expected, found),
                        expected,
                        found,
                        location
                    );
                }

                function peg$parseExpression() {
                    var s0, s1, s2, s3, s4, s5, s6, s7;

                    s0 = peg$currPos;
                    s1 = peg$parseTerm();
                    if (s1 !== peg$FAILED) {
                        s2 = [];
                        s3 = peg$currPos;
                        s4 = peg$parse_();
                        if (s4 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 43) {
                                s5 = peg$c0;
                                peg$currPos++;
                            } else {
                                s5 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c1);
                                }
                            }
                            if (s5 !== peg$FAILED) {
                                s6 = peg$parse_();
                                if (s6 !== peg$FAILED) {
                                    s7 = peg$parseTerm();
                                    if (s7 !== peg$FAILED) {
                                        s4 = [s4, s5, s6, s7];
                                        s3 = s4;
                                    } else {
                                        peg$currPos = s3;
                                        s3 = peg$FAILED;
                                    }
                                } else {
                                    peg$currPos = s3;
                                    s3 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s3;
                                s3 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                        }
                        while (s3 !== peg$FAILED) {
                            s2.push(s3);
                            s3 = peg$currPos;
                            s4 = peg$parse_();
                            if (s4 !== peg$FAILED) {
                                if (input.charCodeAt(peg$currPos) === 43) {
                                    s5 = peg$c0;
                                    peg$currPos++;
                                } else {
                                    s5 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c1);
                                    }
                                }
                                if (s5 !== peg$FAILED) {
                                    s6 = peg$parse_();
                                    if (s6 !== peg$FAILED) {
                                        s7 = peg$parseTerm();
                                        if (s7 !== peg$FAILED) {
                                            s4 = [s4, s5, s6, s7];
                                            s3 = s4;
                                        } else {
                                            peg$currPos = s3;
                                            s3 = peg$FAILED;
                                        }
                                    } else {
                                        peg$currPos = s3;
                                        s3 = peg$FAILED;
                                    }
                                } else {
                                    peg$currPos = s3;
                                    s3 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s3;
                                s3 = peg$FAILED;
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c2(s1, s2);
                            s0 = s1;
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }

                    return s0;
                }

                function peg$parseTerm() {
                    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

                    s0 = peg$currPos;
                    if (input.substr(peg$currPos, 6) === peg$c3) {
                        s1 = peg$c3;
                        peg$currPos += 6;
                    } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$c4);
                        }
                    }
                    if (s1 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 40) {
                            s2 = peg$c5;
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c6);
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            s3 = peg$parse_();
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parseString();
                                if (s4 !== peg$FAILED) {
                                    s5 = peg$parse_();
                                    if (s5 !== peg$FAILED) {
                                        if (input.charCodeAt(peg$currPos) === 44) {
                                            s6 = peg$c7;
                                            peg$currPos++;
                                        } else {
                                            s6 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$c8);
                                            }
                                        }
                                        if (s6 !== peg$FAILED) {
                                            s7 = peg$parse_();
                                            if (s7 !== peg$FAILED) {
                                                s8 = peg$parseInteger();
                                                if (s8 !== peg$FAILED) {
                                                    if (input.charCodeAt(peg$currPos) === 41) {
                                                        s9 = peg$c9;
                                                        peg$currPos++;
                                                    } else {
                                                        s9 = peg$FAILED;
                                                        if (peg$silentFails === 0) {
                                                            peg$fail(peg$c10);
                                                        }
                                                    }
                                                    if (s9 !== peg$FAILED) {
                                                        peg$savedPos = s0;
                                                        s1 = peg$c11(s4, s8);
                                                        s0 = s1;
                                                    } else {
                                                        peg$currPos = s0;
                                                        s0 = peg$FAILED;
                                                    }
                                                } else {
                                                    peg$currPos = s0;
                                                    s0 = peg$FAILED;
                                                }
                                            } else {
                                                peg$currPos = s0;
                                                s0 = peg$FAILED;
                                            }
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$FAILED;
                                        }
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$FAILED;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$FAILED;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                        }
                    } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                    }
                    if (s0 === peg$FAILED) {
                        s0 = peg$parseString();
                    }

                    return s0;
                }

                function peg$parseString() {
                    var s0, s1, s2;

                    peg$silentFails++;
                    s0 = peg$currPos;
                    s1 = [];
                    if (peg$c13.test(input.charAt(peg$currPos))) {
                        s2 = input.charAt(peg$currPos);
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$c14);
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        while (s2 !== peg$FAILED) {
                            s1.push(s2);
                            if (peg$c13.test(input.charAt(peg$currPos))) {
                                s2 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c14);
                                }
                            }
                        }
                    } else {
                        s1 = peg$FAILED;
                    }
                    if (s1 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c15();
                    }
                    s0 = s1;
                    peg$silentFails--;
                    if (s0 === peg$FAILED) {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$c12);
                        }
                    }

                    return s0;
                }

                function peg$parseInteger() {
                    var s0, s1, s2;

                    peg$silentFails++;
                    s0 = peg$currPos;
                    s1 = [];
                    if (peg$c17.test(input.charAt(peg$currPos))) {
                        s2 = input.charAt(peg$currPos);
                        peg$currPos++;
                    } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$c18);
                        }
                    }
                    if (s2 !== peg$FAILED) {
                        while (s2 !== peg$FAILED) {
                            s1.push(s2);
                            if (peg$c17.test(input.charAt(peg$currPos))) {
                                s2 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c18);
                                }
                            }
                        }
                    } else {
                        s1 = peg$FAILED;
                    }
                    if (s1 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c19();
                    }
                    s0 = s1;
                    peg$silentFails--;
                    if (s0 === peg$FAILED) {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$c16);
                        }
                    }

                    return s0;
                }

                function peg$parse_() {
                    var s0, s1;

                    peg$silentFails++;
                    s0 = [];
                    if (peg$c21.test(input.charAt(peg$currPos))) {
                        s1 = input.charAt(peg$currPos);
                        peg$currPos++;
                    } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$c22);
                        }
                    }
                    while (s1 !== peg$FAILED) {
                        s0.push(s1);
                        if (peg$c21.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c22);
                            }
                        }
                    }
                    peg$silentFails--;
                    if (s0 === peg$FAILED) {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                            peg$fail(peg$c20);
                        }
                    }

                    return s0;
                }

                function random(group, num) {
                    function shuffle(array) {
                        var tmp, current, top = array.length;

                        if (top) while (--top) {
                            current = Math.floor(Math.random() * (top + 1));
                            tmp = array[current];
                            array[current] = array[top];
                            array[top] = tmp;
                        }

                        return array;
                    }

                    var shuffled = shuffle(group);
                    return shuffled.slice(0, num)
                }

                peg$result = peg$startRuleFunction();

                if (peg$result !== peg$FAILED && peg$currPos === input.length) {
                    return peg$result;
                } else {
                    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
                        peg$fail(peg$endExpectation());
                    }

                    throw peg$buildStructuredError(
                        peg$maxFailExpected,
                        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
                        peg$maxFailPos < input.length
                            ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
                            : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
                    );
                }
            }

            return {
                SyntaxError: peg$SyntaxError,
                parse: peg$parse
            };
        })()
    );

    define('bitbucket-plugin/pullrequest-create-page', [
        'aui',
        'aui/flag',
        'jquery',
        'lodash',
        'bitbucket/util/events',
        'bitbucket/util/state',
        'parser'
    ], function (AJS,
                 auiFlag,
                 jQuery,
                 _,
                 events,
                 pageState,
                 parser) {
        'use strict';
        var listId = "ul_reviewers_list";
        var reviewersDataKey = "reviewers";
        var buttonIconId = "img_group_icon";

        function getGroupIcon() {
            return '<img id="' + buttonIconId + '" style="width:16px; height:16px;" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADE6YVjAAABiElEQVRIS72V/zEEQRCFv4sAESADIkAEZIAMXASIABEgAyJABC4DRIAIqE/NXu3Oza/aOtf/bO1uT7/u1697JqzAJivAoAZyBBwCWyGZGXAJfIX3HWAN+ADecwmXQO6A48RBg/nvBhB0M/g8hAT8NrAcyAlwW6Gyq+gq8tsN4PPPOZBnYK8CYkUG/Iz8HgFproLIuVzXzCR/IqcXYL8FJD5Y6ulokBa6VJQZv0UZKIizlkpUitItmdxfA0//2RP7tp1o/D2gOquNb6HLBkvLay/ed6BwMCs5CTvJ/cMp2pSvIP2BXajCg6WJL/XFflwkEtnorZwqXTqUqjkIvMdrJ5l0bUHm5iU1hCbmTpvG1YwFkRbpzK0eweyPAsr2xNXughysh173PXwa3m2+kk2tIedoGleiszzngscqE8ysFYLP1ADPQWyymfscY86Flbl9z6MAMyuRGmdifUz03hk3gLOjtLub9O+3ILkbcAzmwl3SgbTeHS2gxlJ5A7MSy1umLcSrzclSwH8BMXpPGYwvvtgAAAAASUVORK5CYII="/>';
        }

        function getGroupIconLoader() {
            return '<img id="' + buttonIconId + '" src="data:image/gif;base64,R0lGODlhEAAQAPYAAP///wAAANTU1JSUlGBgYEBAQERERG5ubqKiotzc3KSkpCQkJCgoKDAwMDY2Nj4+Pmpqarq6uhwcHHJycuzs7O7u7sLCwoqKilBQUF5eXr6+vtDQ0Do6OhYWFoyMjKqqqlxcXHx8fOLi4oaGhg4ODmhoaJycnGZmZra2tkZGRgoKCrCwsJaWlhgYGAYGBujo6PT09Hh4eISEhPb29oKCgqioqPr6+vz8/MDAwMrKyvj4+NbW1q6urvDw8NLS0uTk5N7e3s7OzsbGxry8vODg4NjY2PLy8tra2np6erS0tLKyskxMTFJSUlpaWmJiYkJCQjw8PMTExHZ2djIyMurq6ioqKo6OjlhYWCwsLB4eHqCgoE5OThISEoiIiGRkZDQ0NMjIyMzMzObm5ri4uH5+fpKSkp6enlZWVpCQkEpKSkhISCIiIqamphAQEAwMDKysrAQEBJqamiYmJhQUFDg4OHR0dC4uLggICHBwcCAgIFRUVGxsbICAgAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/hpDcmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAEAAQAAAHjYAAgoOEhYUbIykthoUIHCQqLoI2OjeFCgsdJSsvgjcwPTaDAgYSHoY2FBSWAAMLE4wAPT89ggQMEbEzQD+CBQ0UsQA7RYIGDhWxN0E+ggcPFrEUQjuCCAYXsT5DRIIJEBgfhjsrFkaDERkgJhswMwk4CDzdhBohJwcxNB4sPAmMIlCwkOGhRo5gwhIGAgAh+QQJCgAAACwAAAAAEAAQAAAHjIAAgoOEhYU7A1dYDFtdG4YAPBhVC1ktXCRfJoVKT1NIERRUSl4qXIRHBFCbhTKFCgYjkII3g0hLUbMAOjaCBEw9ukZGgidNxLMUFYIXTkGzOmLLAEkQCLNUQMEAPxdSGoYvAkS9gjkyNEkJOjovRWAb04NBJlYsWh9KQ2FUkFQ5SWqsEJIAhq6DAAIBACH5BAkKAAAALAAAAAAQABAAAAeJgACCg4SFhQkKE2kGXiwChgBDB0sGDw4NDGpshTheZ2hRFRVDUmsMCIMiZE48hmgtUBuCYxBmkAAQbV2CLBM+t0puaoIySDC3VC4tgh40M7eFNRdH0IRgZUO3NjqDFB9mv4U6Pc+DRzUfQVQ3NzAULxU2hUBDKENCQTtAL9yGRgkbcvggEq9atUAAIfkECQoAAAAsAAAAABAAEAAAB4+AAIKDhIWFPygeEE4hbEeGADkXBycZZ1tqTkqFQSNIbBtGPUJdD088g1QmMjiGZl9MO4I5ViiQAEgMA4JKLAm3EWtXgmxmOrcUElWCb2zHkFQdcoIWPGK3Sm1LgkcoPrdOKiOCRmA4IpBwDUGDL2A5IjCCN/QAcYUURQIJIlQ9MzZu6aAgRgwFGAFvKRwUCAAh+QQJCgAAACwAAAAAEAAQAAAHjIAAgoOEhYUUYW9lHiYRP4YACStxZRc0SBMyFoVEPAoWQDMzAgolEBqDRjg8O4ZKIBNAgkBjG5AAZVtsgj44VLdCanWCYUI3txUPS7xBx5AVDgazAjC3Q3ZeghUJv5B1cgOCNmI/1YUeWSkCgzNUFDODKydzCwqFNkYwOoIubnQIt244MzDC1q2DggIBACH5BAkKAAAALAAAAAAQABAAAAeJgACCg4SFhTBAOSgrEUEUhgBUQThjSh8IcQo+hRUbYEdUNjoiGlZWQYM2QD4vhkI0ZWKCPQmtkG9SEYJURDOQAD4HaLuyv0ZeB4IVj8ZNJ4IwRje/QkxkgjYz05BdamyDN9uFJg9OR4YEK1RUYzFTT0qGdnduXC1Zchg8kEEjaQsMzpTZ8avgoEAAIfkECQoAAAAsAAAAABAAEAAAB4iAAIKDhIWFNz0/Oz47IjCGADpURAkCQUI4USKFNhUvFTMANxU7KElAhDA9OoZHH0oVgjczrJBRZkGyNpCCRCw8vIUzHmXBhDM0HoIGLsCQAjEmgjIqXrxaBxGCGw5cF4Y8TnybglprLXhjFBUWVnpeOIUIT3lydg4PantDz2UZDwYOIEhgzFggACH5BAkKAAAALAAAAAAQABAAAAeLgACCg4SFhjc6RhUVRjaGgzYzRhRiREQ9hSaGOhRFOxSDQQ0uj1RBPjOCIypOjwAJFkSCSyQrrhRDOYILXFSuNkpjggwtvo86H7YAZ1korkRaEYJlC3WuESxBggJLWHGGFhcIxgBvUHQyUT1GQWwhFxuFKyBPakxNXgceYY9HCDEZTlxA8cOVwUGBAAA7AAAAAAAAAAAA"/>';
        }

        /**
         * Use bitbucket api to search for the user
         * @param {integer} term name or email of the user to search.
         */
        function searchUsersAsync(term) {
            var deferred = jQuery.Deferred();

            var searchParams = {avatarSize: 32, permission: "LICENSED_USER", start: 0, filter: term};

            jQuery.get("/rest/api/latest/users", searchParams)
                .done(function (data) {
                    if (data.values.length > 0) {
                        var rawd = data.values[0];
                        var select2Data = {
                            id: rawd.name,
                            text: rawd.displayName || rawd.name,
                            item: rawd
                        };

                        deferred.resolve(select2Data);
                    }

                    deferred.resolve(null);
                })
                .fail(function () {
                    // use resolve instead of reject to avoid prematured end with $.when
                    deferred.resolve(null);
                });

            return deferred.promise();
        }

        function attachDropdownClickEvent(dropdown) {
            jQuery(dropdown).find('#' + listId).find('li').click(function () {
                var $element = jQuery(this);
                var reviewers = $element.data(reviewersDataKey);

                if (!jQuery.isArray(reviewers)) {
                    reviewers = parser.parse(reviewers);
                }

                var differedList = [];
                var select2DataArray = [];

                // show loader
                jQuery('#' + buttonIconId).replaceWith(getGroupIconLoader());

                reviewers.forEach(function (reviewer) {
                    // request user data from search api
                    var searchDeferred = searchUsersAsync(reviewer);
                    // waiting list
                    differedList.push(searchDeferred);
                    // add to the array
                    searchDeferred.done(function (select2Data) {
                        if (select2Data && pageState.getCurrentUser().id !== select2Data.item.id) {
                            select2DataArray.push(select2Data);
                        }
                    });
                });

                jQuery.when.apply(jQuery, differedList).done(function () {
                    // redisplay icon and remove loader
                    jQuery('#' + buttonIconId).replaceWith(getGroupIcon());

                    var replacePrevious = jQuery('#replaceGroups').is(':checked') || false;
                    //////////// update the user selector
                    // need this to reproduce the event triggered by select2 on a single selection. (change Event contain "added" or "removed" property set with an object and not an array)
                    // Without that the widget/searchable-multi-selector wrapper made by atlassian won't change his data internally corrrectly

                    // clean (for atlassian wrapper)
                    var allUsers = AJS.$('#reviewers').auiSelect2("data");
                    AJS.$('#reviewers').auiSelect2("data", null).trigger("change");
                    AJS.$('#reviewers').auiSelect2("val", null).trigger("change");
                    allUsers.forEach(function (item) {
                        var e = new jQuery.Event("change");
                        e.removed = item;
                        AJS.$('#reviewers').trigger(e);
                    });

                    if (!replacePrevious) {
                        jQuery.merge(select2DataArray, allUsers);
                    }

                    // add (for atlassian wrapper)
                    select2DataArray.forEach(function (select2Data) {
                        var e = new jQuery.Event("change");
                        e.added = select2Data;
                        AJS.$('#reviewers').trigger(e);
                    });

                    // update displayed value (for select2)
                    AJS.$('#reviewers').auiSelect2("data", select2DataArray);
                });
            });
        }

        function injectReviewersDropdown(jsonGroups) {
            var $reviewersInput = jQuery('#s2id_reviewers');
            if ($reviewersInput.length == 0) {
                return;
            }

            // empty dropdown for reviewers group
            var checkedProperty = '';
            if ((localStorage.getItem('replaceGroupsState') || false).toString().toBool()) {
                checkedProperty = ' checked="checked"';
            }

            var dropdownHTML = ([
                '<a href="#reviewers_list" aria-owns="reviewers_list" aria-haspopup="true" class="aui-button aui-style-default aui-dropdown2-trigger" style="margin-left: 10px; display: inline-block; top: -10px;">',
                getGroupIcon(),
                '</a>',
                '<div id="reviewers_list" class="aui-style-default aui-dropdown2">',
                '<ul class="aui-list-truncate" id="' + listId + '">',
                '</ul>',
                '</div>',
                '<div class="checkbox" id="replaceGroupsDiv">',
                '<input class="checkbox" type="checkbox" name="replaceGroups" id="replaceGroups"' + checkedProperty + '>',
                '<label for="replaceGroups">Replace</label>',
                '</div>'
            ]).join("\n");

            // jquery instance
            var $dropdown = jQuery(dropdownHTML);

            // add groups list
            for(var group in jsonGroups) {
                var groupVal = jsonGroups[group];
                var linkText = group + (jQuery.isArray(groupVal) ? ' (' + groupVal.length + ' reviewers)' : '');
                var $a = jQuery('<a href="Javascript:void(0)"></a>').text(linkText);
                var $li = jQuery('<li></li>').append($a).data(reviewersDataKey, groupVal);
                $dropdown.find('#' + listId).append($li);
            }


            // jsonGroups.groups.forEach(function (group) {
            //     var linkText = group.groupName + ' (' + group.reviewers.length + ' reviewers)';
            //     var $a = jQuery('<a href="Javascript:void(0)"></a>').text(linkText);
            //     var $li = jQuery('<li></li>').append($a).data(reviewersDataKey, group.reviewers);
            //     $dropdown.find('#' + listId).append($li);
            // });


            // click event
            attachDropdownClickEvent($dropdown);

            // save checkbox state on change
            $dropdown.find('#replaceGroups').on('change', function (data) {
                var state = jQuery(this).is(':checked') || false;
                localStorage.setItem('replaceGroupsState', state);
            });

            // fix z-index bug
            $dropdown.on({
                "aui-dropdown2-show": function () {
                    window.setTimeout(function () {
                        jQuery("#reviewers_list").css("z-index", "4000");
                    }, 50);
                }
            });

            // append to the page
            $reviewersInput.after($dropdown);
        }

        function injectTemplateButton(templateStr) {
            var buttonHTML = '<button class="aui-button aui-button-subtle aui-button-compact" title="Injects standard PR template">Standard template</button>';

            // jquery instance
            var $button = jQuery(buttonHTML);

            // click event
            $button.click(function (e) {
                e.preventDefault();
                var template = templateStr.split(',').join("\n");
                jQuery('#pull-request-description').val(template);
            });

            // append to the page
            var markDownHelp = jQuery('.pull-request-details a.markup-preview-help');
            jQuery(markDownHelp[0]).before($button);
        }

        return {
            injectTemplateButton: injectTemplateButton,
            injectReviewersDropdown: injectReviewersDropdown
        };
    });

    define('bitbucket-plugin/pullrequest-details-page', [
        'aui',
        'aui/flag',
        'jquery',
        'lodash',
        'bitbucket/util/events',
        'bitbucket/util/state',
        'bitbucket-plugin/url'
    ], function (AJS,
                 auiFlag,
                 jQuery,
                 _,
                 events,
                 pageState,
                 urlUtil) {
        'use strict';
        //////////////////////////////////////////////////// Build with jenkins link
        function addBuildLink() {
            var pr = pageState.getPullRequest();
            var user = pageState.getCurrentUser();

            if (!pr) {
                return;
            }

            //if(!jQuery('.build-status-summary').length) { }
            var $startWrapper = jQuery('<div class="plugin-item build-status-summary"></div>');
            var $startLink = jQuery('<a href="#"><span class="aui-icon aui-icon-small aui-iconfont-devtools-side-diff" title="Builds">Build status</span><span class="label">Start build test</span></a>');
            $startLink.click(function () {
                var urlBase = 'http://<yourjenkinsurl>';
                var url = urlBase + '/job/[your_job_name]/';
                $startLink.find('span.label').text('Starting...');

                var userName = (window.hipchatUsername || '').replace('@', '');
                if (typeof window.chromeExtId !== 'undefined' && typeof window.chrome !== 'undefined') {
                    window.communication.runtime.sendMessage(window.chromeExtId, {
                        method: 'POST',
                        action: 'xhttp',
                        url: url + 'buildWithParameters',
                        data: 'PULLREQUEST_ID=' + pr.id + '&HIPCHAT_USER=' + userName
                    }, function (data) {
                        $startLink.find('span.label').text('Start build test');
                        if (data.status == 201) {
                            auiFlag({
                                type: 'info',
                                title: 'Jenkins Build Started!',
                                body: '<br><a href="' + url + '" target="_blank">Go to Jenkins</a>', // shourld be data.redirect
                                close: 'auto'
                            });
                            $startLink.unbind('click');
                            $startLink.attr('href', url).attr('target', '_blank'); // should be data.redirect
                            $startLink.find('span.label').text('See started job on jenkins!');
                        }
                        else if (data.status == 403) {
                            auiFlag({
                                type: 'error',
                                title: 'You are not login to jenkins!',
                                body: '<br><a href="' + urlBase + '/login" target="_blank">Go to Jenkins</a>', // shourld be data.redirect
                                close: 'auto'
                            });
                        }
                        else {
                            auiFlag({
                                type: 'warning',
                                title: 'Could not start job, please check jenkins!',
                                body: '<br><a href="' + url + '" target="_blank">Go to Jenkins</a>', // shourld be data.redirect
                                close: 'auto'
                            });
                        }
                    });
                }
                else {
                    window.ajaxRequest({
                            method: 'POST',
                            url: url,
                            data: {
                                'PULLREQUEST_ID': pr.id,
                                'HIPCHAT_USER': userName
                            }
                        },
                        function (location) {
                            auiFlag({
                                type: 'info',
                                title: 'Jenkins Build Started!',
                                body: '<br><a href="' + location + '">Go to Jenkins</a>',
                                close: 'auto'
                            });
                            $startLink.unbind('click');
                            $startLink.attr('href', location);
                            $startLink.find('span.label').text('See started job on jenkins!');
                        });
                }

                return false;
            });

            $startWrapper.append($startLink);
            jQuery('.plugin-section-primary').prepend($startWrapper);
        }

        //////////////////////////////////////////////////// Clickable branch on PR page
        function attachNavigateToBranchLink() {
            var pr = pageState.getPullRequest();

            var $branchOriginSpan = jQuery('.ref-name-from');
            if ($branchOriginSpan.length === 0) {
                $branchOriginSpan = jQuery('.source-branch');
            }
            if ($branchOriginSpan.length) {
                var urlFrom = urlUtil.buildSlug(pr.fromRef.repository);
                urlFrom += '?at=' + pr.fromRef.id;
                //$branchOriginSpan.css('cursor', 'pointer').click(function(){ window.location.href = urlFrom; }).data('url', urlFrom);
                $branchOriginSpan.wrap(jQuery('<a></a>', {href: urlFrom}));
            }

            var $branchDestinationSpan = jQuery('.ref-name-to');
            if ($branchDestinationSpan.length === 0) {
                $branchDestinationSpan = jQuery('.target-branch');
            }
            if ($branchDestinationSpan.length) {
                var urlTo = urlUtil.buildSlug(pr.toRef.repository);
                urlTo += '?at=' + pr.toRef.id;
                //$branchDestinationSpan.css('cursor', 'pointer').click(function(){ window.location.href = urlTo; }).data('url', urlTo);
                $branchDestinationSpan.wrap(jQuery('<a></a>', {href: urlTo}));
            }
        }

        //////////////////////////////////////////////////// dropdoan list with git checkout commands
        function retrieveLastCommitOfBranch(repoBrowseUrl, branchPath) {
            var relativeUrl = repoBrowseUrl.replace('browse', 'commits');
            var url = '/rest/api/1.0' + relativeUrl + '?until=' + branchPath + '&limit=1';

            return jQuery.get(url)
                .then(function (data) {
                    return data.values.length > 0 ? data.values[0].id : '';
                });
        }

        function addCheckoutLink() {
            var pr = pageState.getPullRequest();

            if (!pr.fromRef.repository.project) {
                console.info('no rights to display checkout dropdown');
                return;
            }

            var cloneUrl;
            var repoName = pr.fromRef.repository.name;
            var branchOrigin = pr.fromRef.displayId;
            var remoteName = pr.fromRef.repository.project.owner ? pr.fromRef.repository.project.owner.slug : pr.fromRef.repository.project.name;

            if (!pr.fromRef.repository.links.clone) {
                var $link = jQuery(['<div class="pull-request-checkout"><a id="s2id_ddCheckoutCommand" href="#ddCheckoutCommand" aria-owns="ddCheckoutCommand" aria-haspopup="true" class="ddCheckoutCommandPR aui-button aui-style-default aui-dropdown2-trigger">',
                    '<span class="aui-icon aui-icon-small aui-iconfont-devtools-checkout"></span> ',
                    '<span class="name" title="copy git checkout cmmands to paste to terminal">Checkout</span> ',
                    '</a>',
                    '<div id="ddCheckoutCommand" class="aui-style-default aui-dropdown2">',
                    '	<ul class="aui-list-truncate">',
                    '		<li data-action=""><a href="javascript:void(0)" class="checkoutCommand_link" id="nothing">Sorry you don\'t have clone permission</a></li>',
                    '	</ul>',
                    '</div></div>'].join('\n'));
                if (jQuery('.pull-request-metadata-primary').length > 0) {
                    jQuery('.pull-request-metadata-primary').find('.pull-request-branches').after($link);
                } else {
                    jQuery('.pull-request-metadata').append($link);
                }

                return;
            }

            pr.fromRef.repository.links.clone.forEach(function (clone) {
                if (clone.name === 'ssh') {
                    cloneUrl = clone.href;
                }
            });

            if (!cloneUrl) {
                cloneUrl = pr.fromRef.repository.links.clone[0].href;
            }

            var $link = jQuery(['<div class="pull-request-checkout"><a id="s2id_ddCheckoutCommand" href="#ddCheckoutCommand" aria-owns="ddCheckoutCommand" aria-haspopup="true" class="ddCheckoutCommandPR aui-button aui-style-default aui-dropdown2-trigger">',
                '<span class="aui-icon aui-icon-small aui-iconfont-devtools-checkout"></span> ',
                '<span class="name" title="copy git checkout cmmands to paste to terminal">Checkout</span> ',
                '</a>',
                '<div id="ddCheckoutCommand" class="aui-style-default aui-dropdown2">',
                '	<ul class="aui-list-truncate">',
                '		<li data-action="clone"><a href="javascript:void(0)" class="checkoutCommand_link" id="cloneCommand">Clone</a></li>',
                '		<li data-action="newremote"><a href="javascript:void(0)" class="checkoutCommand_link" id="remoteCommand">Add remote</a></li>',
                '		<li data-action="newremotenewbranch"><a href="javascript:void(0)" class="checkoutCommand_link">Add remote/Create branch</a></li>',
                '		<li data-action="newbranch"><a href="javascript:void(0)" class="checkoutCommand_link">Create branch</a></li>',
                '		<li data-action="checkout"><a href="javascript:void(0)" class="checkoutCommand_link">Checkout existing</a></li>',
                '	</ul>',
                '</div></div>'].join('\n'));

            // git remote naming
            window.repoMapArray.forEach(function (map) {
                if (map.repo === remoteName) {
                    remoteName = map.remote;
                }
            });

            // get last commit of the source branch
            retrieveLastCommitOfBranch(urlUtil.buildSlug(pr.fromRef.repository), pr.fromRef.displayId).then(function (lastBranchCommit) {
                // git commands
                var cloneCommand = 'git clone ' + cloneUrl + ' ' + repoName + '_' + remoteName;
                var addOriginCommand = 'git remote add ' + remoteName + ' ' + cloneUrl;
                var fetchCommand = 'git fetch ' + remoteName;
                var checkoutNewCommand = 'git checkout --track ' + remoteName + '/' + branchOrigin;
                var checkoutCommand = 'git checkout ' + branchOrigin;
                var checkoutLastCommit = 'git checkout ' + pr.fromRef.latestCommit;

                if (lastBranchCommit !== pr.fromRef.latestCommit) {
                    checkoutNewCommand += '; ' + checkoutLastCommit;
                    checkoutCommand += '; ' + checkoutLastCommit;
                }

                var command = '';
                var ddlClicked = false;

                // inject
                if (jQuery('.pull-request-metadata-primary').length > 0) {
                    // bitbucket v4.3
                    jQuery('.pull-request-metadata-primary').find('.pull-request-branches').after($link);
                } else {
                    jQuery('.pull-request-metadata').append($link);
                }

                jQuery('.checkoutCommand_link').click(function (e) {
                    ddlClicked = true;
                    var action = jQuery(e.target).data('action') || jQuery(e.target).parent().data('action');
                    switch (action) {
                        case 'clone':
                            command = cloneCommand;
                            document.execCommand('copy');
                            break;
                        case 'newremote':
                            command = addOriginCommand + '; ' + fetchCommand + ';';
                            document.execCommand('copy');
                            break;
                        case 'newremotenewbranch':
                            command = addOriginCommand + '; ' + fetchCommand + '; ' + checkoutNewCommand;
                            document.execCommand('copy');
                            break;
                        case 'newbranch':
                            command = fetchCommand + '; ' + checkoutNewCommand;
                            document.execCommand('copy');
                            break;
                        case 'checkout':
                            command = fetchCommand + '; ' + checkoutCommand;
                            document.execCommand('copy');
                            break;
                        default:
                            break;
                    }
                });

                jQuery('#cloneCommand').append(' (<span style="font-size:xx-small">' + repoName + '_' + remoteName + '</span>)');
                jQuery('#remoteCommand').append(' (<span style="font-size:xx-small">' + remoteName + '</span>)');


                jQuery(document).on('copy', function (e) {
                    if (ddlClicked) {
                        e.preventDefault();
                        if (e.originalEvent.clipboardData) {
                            e.originalEvent.clipboardData.setData('text/plain', command);
                            auiFlag({
                                type: 'info',
                                title: 'Command copied!',
                                body: 'just paste it in your terminal.',
                                close: 'auto'
                            });
                        }
                        else if (window.clipboardData) {
                            auiFlag({
                                type: 'info',
                                title: 'Sorry copy api is not available!',
                                body: 'Try to update your browser.',
                                close: 'auto'
                            });
                        }

                        ddlClicked = false;
                    }
                });
            });
        }

        //////////////////////////////////////////////////// to go to the corresponding ticket when middle click jira ticket link
        function replaceJiraLink() {
            var href = jQuery('.pull-request-issues-trigger').attr('href') || '';
            jQuery('.pull-request-issues-trigger').attr('href', href.replace('https://jira.rakuten-it.com/jira/', 'https://rakuten.atlassian.net/'))
        }

        //////////////////////////////////////////////////// display on overview page when there is conflicts
        function displayConflicts() {
            var pr = pageState.getPullRequest();

            // get pr changes details
            var url = '/rest/api/1.0' + urlUtil.buildSlug(pr) + '/changes'

            jQuery.get(url).done(function (prDetails) {
                var conflictsCount = 0;
                prDetails.values.forEach(function (details) {
                    if (details.conflict) {
                        conflictsCount++;
                    }
                });

                if (conflictsCount > 0) {
                    var $message = AJS.messages.warning({
                        title: "Conflicts found !",
                        body: "<p> There is " + conflictsCount + " conflicts. Please solve it. </p>",
                        closeable: true
                    });

                    jQuery('.pull-request-metadata').after($message);
                }
            });
        }

        return {
            addBuildLink: addBuildLink,
            attachNavigateToBranchLink: attachNavigateToBranchLink,
            replaceJiraLink: replaceJiraLink,
            addCheckoutLink: addCheckoutLink,
            displayConflicts: displayConflicts
        }
    });

    define('bitbucket-plugin/header-notification', [
        'aui',
        'aui/flag',
        'jquery',
        'lodash',
        'bitbucket/util/events',
        'bitbucket/util/state',
        'bitbucket/util/navbuilder',
        'bitbucket/util/server',
        'moment',
        'bitbucket-plugin/url'
    ], function (AJS, auiFlag, jQuery, _, events, pageState, nav, ajax, moment, urlUtil) {
        'use strict';
        String.prototype.toBool = function () {
            return this.toString().toLowerCase() === 'true';
        };

        var NotificationType = {badge: 'badge_', panel: 'panel_'};

        //////////////////////////////////////////////////// Toolbar icon functions
        var deferredPrRequest;

        function filterAnOrderActivities(activities) {
            var user = pageState.getCurrentUser();
            var returnedActivities = [];
            activities.forEach(function (activity) {
                //if (activity.action == 'RESCOPED') {
                //return false;
                //}
                var outdated = false;
                if (activity.diff && activity.diff.properties) {
                    outdated = !activity.diff.properties.current;
                }

                if (activity.action === 'COMMENTED' && !outdated && (activity.user.name !== user.name || countSubComments(activity.comment).total || countTasks(activity.comment).total)) {
                    jQuery.extend(activity, {activityDate: getMostRecentActivityDate(activity.comment)});
                    returnedActivities.push(activity);
                }
            });

            return _.sortBy(returnedActivities, 'activityDate').reverse();
            ;
        }

        function getLastPRCommentsAsync() {
            var deferredResult = jQuery.Deferred();
            var allPR = [];
            // get lastest PR
            var reqParams = {
                start: 0,
                limit: 1000,
                avatarSize: 96,
                withAttributes: true,
                state: 'OPEN',
                order: 'oldest',
                role: 'reviewer'
            };

            var urlSegments = ['rest', 'inbox', 'latest', 'pull-requests'];
            var urlSegmentsNew = ['rest', 'api', 'latest', 'inbox', 'pull-requests'];

            var reviewersDefered = jQuery.Deferred()
            var resolveReviewers = function (data) {
                reviewersDefered.resolve();
                return data;
            }
            var authorDefered = jQuery.Deferred()
            var resolveAuthor = function (data) {
                authorDefered.resolve();
                return data;
            }

            var buildUrlPR = function (segments, role) {
                reqParams.role = role;
                return nav.newBuilder(segments).withParams(reqParams).build();
            }
            var mergeResults = function (data) {
                jQuery.merge(allPR, data.values)
            };
            var rerunRequest = function (role) {
                return function (err) {
                    var resolveDeferred = role === 'reviewer' ? resolveReviewers : resolveAuthor;
                    if (err.status == 404) {
                        return jQuery
                            .get(buildUrlPR(urlSegments, role))
                            .then(mergeResults)
                            .then(resolveDeferred);
                    }
                }
            };
            var rerunRequestReviewers = rerunRequest('reviewer');
            var rerunRequestAuthor = rerunRequest('author');

            jQuery
                .get(buildUrlPR(urlSegmentsNew, 'reviewer'))
                .then(mergeResults)
                .then(resolveReviewers)
                .fail(rerunRequestReviewers);

            jQuery
                .get(buildUrlPR(urlSegmentsNew, 'author'))
                .then(mergeResults)
                .then(resolveAuthor)
                .fail(rerunRequestAuthor);

            jQuery.when(reviewersDefered, authorDefered).done(function () {
                var activities = [];
                var requests = [];
                // loop through PRs and request activities
                allPR.forEach(function (pr) {
                    requests.push(jQuery.get('/rest/api/1.0' + urlUtil.buildSlug(pr) + '/activities?avatarSize=96').done(function (activityList) {
                        // get comments after PR was updated
                        jQuery.each(activityList.values, function (index, activity) {
                            jQuery.extend(activity, {pullrequest: pr});
                            activities.push(activity);
                        });
                    }));
                });

                jQuery.when.apply(jQuery, requests).always(function () {
                    activities = filterAnOrderActivities(activities);
                    deferredResult.resolve(activities);
                });
            });

            return deferredResult;
        }

        function getLastPRCommentsOnceAsync() {
            if (!deferredPrRequest || deferredPrRequest.state() === 'rejected') {
                deferredPrRequest = getLastPRCommentsAsync();
            }

            // return previous retried activities
            return deferredPrRequest.promise();
        }

        function getMostRecentActivityDate(comment) {
            var date = comment.createdDate;

            comment.tasks.forEach(function (task) {
                date = task.createdDate > date ? task.createdDate : date;
            });

            comment.comments.forEach(function (subcomment) {
                var newDate = getMostRecentActivityDate(subcomment);
                date = newDate > date ? newDate : date;
            });

            return date;
        }

        function filterSubcomments(comment) {
            var user = pageState.getCurrentUser();
            return _.filter(comment.comments, function (c) {
                return c.author.name !== user.name;
            });
        }

        function filterTasks(comment) {
            var user = pageState.getCurrentUser();
            return _.filter(comment.tasks, function (t) {
                return t.author.name !== user.name && t.state === "OPEN";
            });
        }

        function countSubComments(comment) {
            var count = {total: 0, unread: 0};
            var subCommentsFromOthers = filterSubcomments(comment);
            count.total += subCommentsFromOthers.length;
            count.unread += _.filter(subCommentsFromOthers, function (c) {
                return !c.isPanelRead
            }).length;

            comment.comments.forEach(function (subcomment) {
                var result = countSubComments(subcomment);
                count.total += result.total;
                count.unread += result.unread;
            });

            return count;
        }

        function countTasks(comment) {
            var count = {total: 0, unread: 0};
            var taskFromOthers = filterTasks(comment);
            count.total += taskFromOthers.length;
            count.unread += _.filter(taskFromOthers, function (t) {
                return !t.isPanelRead
            }).length;

            comment.comments.forEach(function (subcomment) {
                var result = countTasks(subcomment);
                count.total += result.total;
                count.unread += result.unread;
            });

            return count;
        }

        function countUnreadActivities(activities, prefix) {
            prefix = prefix || '';
            var count = 0;
            var user = pageState.getCurrentUser();

            activities.forEach(function (activity) {
                // verify the comment itself
                var isCommentRead = (localStorage.getItem(prefix + 'comment_' + activity.comment.id) || false).toString().toBool();

                if (prefix === NotificationType.panel) {
                    jQuery.extend(activity.comment, {isPanelRead: isCommentRead});
                }
                else {
                    jQuery.extend(activity.comment, {isBadgeRead: isCommentRead});
                }

                count += isCommentRead ? 0 : activity.comment.author.name !== user.name ? 1 : 0;

                // sub comments
                activity.comment.comments.forEach(function (subComment) {
                    // count sub sub comments
                    count += countUnreadActivities([{comment: subComment}], prefix);
                });

                // tasks
                filterTasks(activity.comment).forEach(function (task) {
                    var isTaskRead = (localStorage.getItem(prefix + 'task_' + task.id) || false).toString().toBool();
                    if (prefix === NotificationType.panel) {
                        jQuery.extend(task, {isPanelRead: isTaskRead});
                    }
                    else {
                        jQuery.extend(task, {isBadgeRead: isTaskRead});
                    }
                    count += isTaskRead ? 0 : 1;
                });
            });

            // if false continue to verify tasks
            return count;
        }

        function hasUnreadActivities(activity, prefix) {
            return countUnreadActivities([activity], prefix) > 0;
        }

        var htmlComments = {};

        function markdownToHtml(msg, msgId) {
            if (htmlComments[msgId]) {
                return jQuery.Deferred().resolve(htmlComments[msgId]).promise();
            }

            var url = nav.rest().markup().preview().build();
            return ajax.rest({
                type: 'POST',
                url: url,
                data: msg,
                dataType: 'json'
            }).then(function (result) {
                htmlComments[msgId] = result.html;
                return result.html;
            });
        }

        function findUserBySlug(slug) {
            var url = nav.rest().users().addPathComponents(slug).withParams({avatarSize: 64}).build();

            return jQuery.ajax({
                type: 'GET',
                url: url,
                dataType: 'json'
            });
        }

        function markActivitiesAsRead(activities, prefix) {
            prefix = prefix || '';
            activities.forEach(function (activity) {
                localStorage.setItem(prefix + 'comment_' + activity.comment.id, true);

                activity.comment.comments.forEach(function (subComment) {
                    markActivitiesAsRead([{comment: subComment}], prefix);
                });

                activity.comment.tasks.forEach(function (task) {
                    localStorage.setItem(prefix + 'task_' + task.id, true);
                });
            });
        }

        function generateCommentsTable(activities) {
            var $table = jQuery('<table></table>')
                .addClass('aui')
                .addClass('paged-table')
                .addClass('comments-table');

            // header
            $table.append('<thead>').find('thead').append('<tr>').find('tr')
                .append('<th class="author">Author</th>')
                .append('<th class="comment">Comment</th>')
                .append('<th class="title">PR</th>')
                .append('<th class="updated">Updated</th>')
                .append('<th class="comment-count">Activities</th>');

            // body
            var $tbody = $table.append('<tbody>').find('tbody');
            activities.forEach(function (activity) {
                var $msgRow = jQuery('<td class="comment message markup">' + activity.comment.text + '</td>');
                var $userRow = jQuery('<td class="author">' + activity.comment.author.name + '</td>');
                var $countRow = jQuery('<td class="comment-count"></td>');
                var $prRow = jQuery('<td class="title"><a href="' + urlUtil.buildSlug(activity.pullrequest) + '/overview?commentId=' + activity.comment.id + '" title="{' + activity.pullrequest.author.user.name + '} ' + activity.pullrequest.title + '">' + activity.pullrequest.title + '</a></td>');
                var $updatedRow = jQuery('<td class="comment-count"></td>').html(moment(activity.activityDate).fromNow());

                var isLineUnread = hasUnreadActivities(activity, NotificationType.panel);
                var isBadgeUnread = hasUnreadActivities(activity, NotificationType.badge);

                // convert raw msg to html
                markdownToHtml(activity.comment.text, activity.comment.id).done(function (msg) {
                    $msgRow.html(msg);
                });

                // avatar
                var $avatar = jQuery(bitbucket.internal.widget.avatar({
                    size: 'small',
                    person: activity.comment.author,
                    tooltip: activity.comment.author.displayName
                }));
                $userRow.html($avatar);
                $avatar.find('img').tooltip();

                // sub comments count
                var commentCount = countSubComments(activity.comment);
                var $commentsCount = jQuery('<span class="comment-count" title="' + commentCount.unread + ' new unread comments">');
                $commentsCount.append(jQuery(aui.icons.icon({
                    useIconFont: true,
                    icon: 'comment',
                    accessibilityText: 'comments'
                })));
                var $commentDigit = jQuery('<span>' + commentCount.total + '<span>');
                if (commentCount.unread > 0) {
                    $commentsCount.addClass('digit-unread');
                }
                $commentsCount.append($commentDigit);
                $commentsCount.tooltip();

                // task count
                var taskCount = countTasks(activity.comment);
                var $tasksCount = jQuery('<span class="pr-list-open-task-count" title="' + taskCount.unread + ' new unread tasks">');
                $tasksCount.append(jQuery(aui.icons.icon({
                    useIconFont: true,
                    icon: 'editor-task',
                    accessibilityText: 'tasks'
                })));
                var $taskDigit = jQuery('<span class="task-count">' + taskCount.total + '<span>');
                if (taskCount.unread > 0) {
                    $tasksCount.addClass('digit-unread');
                }
                $tasksCount.append($taskDigit);
                $tasksCount.tooltip();

                // append to cell
                $countRow
                    .append($commentsCount)
                    .append($tasksCount);

                // build row
                var $tr = $tbody.append('<tr>').find('tr:last-child');
                if (isLineUnread) {
                    $tr.addClass('line-unread');
                }
                if (isBadgeUnread) {
                    $tr.addClass('line-unread-strong');
                }

                $prRow.find('a').tooltip();

                $tr.append($userRow)
                    .append($msgRow)
                    .append($prRow)
                    .append($updatedRow)
                    .append($countRow);
            });

            if (activities.length === 0) {
                $table = AJS.messages.info({
                    title: "No comments",
                    body: "<p> There is no comment on any open pull request! </p>",
                    closeable: false
                });
            }

            return $table;
        }

        function updateChromeIconBadge(badgeText) {
            if (typeof window.chromeExtId !== 'undefined' && typeof window.chrome !== 'undefined') {
                window.communication.runtime.sendMessage(window.chromeExtId, {
                    action: 'setBadgeCount',
                    badgeCount: badgeText.toString()
                });
            }
        }

        function updateUI($content, forceReload, desktopNotification) {
            forceReload = forceReload || false;
            desktopNotification = desktopNotification || false;
            var $toolbar = jQuery('#inbox-messages');

            // display loader in panel
            if ($content) {
                var $spinner = jQuery('<div class="loading-resource-spinner"></div>');
                jQuery('#global-div-comments-notif').remove();
                var $globalDiv = jQuery('<div id="global-div-comments-notif"></div>');
                $globalDiv.append('<h2>Last pull requests comments</h2>');
                $globalDiv.append($spinner);
                $content.empty().append($globalDiv);
                $spinner.show().spin('medium');
            }

            var dataLoader = forceReload ? getLastPRCommentsAsync : getLastPRCommentsOnceAsync;
            dataLoader()
                .always(function () {
                    if ($content) {
                        $content.empty();
                        $spinner.spinStop().remove();
                    }
                })
                .done(function (activities) {
                    // desktop notification on chrome
                    if (!$content && desktopNotification) {
                        displayDesktopNotification(activities);
                    }
                    // update icon
                    var eventCount = countUnreadActivities(activities, NotificationType.badge);
                    if (!$content) {
                        $toolbar.find('.aui-badge').remove();
                        updateChromeIconBadge('');
                        if (eventCount > 0) {
                            var $badge = jQuery(aui.badges.badge({
                                text: eventCount
                            }));
                            $toolbar.append($badge);
                            setTimeout(function () {
                                // Needed for the transition to trigger
                                $badge.addClass('visible');
                            }, 0);

                            updateChromeIconBadge(eventCount);
                        }
                    }

                    // update panel
                    if ($content) {
                        jQuery('#global-div-comments-notif').remove();
                        var $globalDiv = jQuery('<div id="global-div-comments-notif"></div>');
                        $globalDiv.append('<h2>Last pull requests comments</h2>');
                        var $wrapper = jQuery('<div class="inbox-table-wrapper aui-tabs horizontal-tabs"></div>');
                        $wrapper.append(generateCommentsTable(activities));
                        $globalDiv.append($wrapper);
                        $content.append($globalDiv);
                        // remove badge notification. Panel highlight notification are remove when PR is open
                        markActivitiesAsRead(activities, NotificationType.badge);
                    }
                });
        }

        function createCommentsDialog() {
            var inlineDialog;

            var onShowDialog = function ($content, trigger, showPopup) {
                showPopup();
                jQuery(document).on('keyup', hideOnEscapeKeyUp);

                // hide if another dialog is shown
                AJS.dialog2.on('show', hideOnDialogShown);

                updateUI($content);
            };

            var hideOnEscapeKeyUp = function (e) {
                if (e.keyCode === jQuery.ui.keyCode.ESCAPE) {
                    inlineDialog.hide();
                    e.preventDefault();
                }
            };

            var onHideDialog = function () {
                jQuery(document).off('keyup', hideOnEscapeKeyUp);
                AJS.dialog2.off('show', hideOnDialogShown);

                if (jQuery(document.activeElement).closest('#inbox-messages-content').length) {
                    // if the focus is inside the dialog, you get stuck when it closes.
                    document.activeElement.blur();
                }

                // refresh icon notify count
                updateUI();
            };

            var hideOnDialogShown = function () {
                inlineDialog.hide();
            };

            var $inboxTrigger = jQuery("#inbox-messages");
            if ($inboxTrigger.length && pageState.getCurrentUser()) {
                inlineDialog = AJS.InlineDialog($inboxTrigger, 'inbox-messages-content', onShowDialog, {
                    width: 870,
                    hideCallback: onHideDialog
                });
            }

            return inlineDialog;
        }

        function displayDesktopNotification(activities) {
            if (Notification.permission !== "granted" || window.notificationState.toString() === '0') {
                return;
            }
            var user = pageState.getCurrentUser();
            var prefix = "notif_";

            activities.forEach(function (activity) {
                var commentKey = prefix + 'comment_' + activity.comment.id;
                var state = localStorage.getItem(commentKey);
                localStorage.setItem(commentKey, true);

                var isIncluded = true; // all notifications
                if (window.notificationType.toString() === '0') { // prAndMentioned only (also include answer)
                    var isIncluded = false;
                    // filter PR which are not from current user
                    if (activity.pullrequest.author.user.name === user.name) {
                        isIncluded = true;
                    }

                    // filter mentioned
                    if (activity.comment.text.indexOf('@"' + user.name + '"') > -1) {
                        isIncluded = true;
                    }

                    // is an answer to current user message
                    if (activity.wasOwner) {
                        isIncluded = true;
                    }
                }

                var notYetViewed = !(state || false).toString().toBool();
                // notification for comments
                if (isIncluded && activity.comment.author.name !== user.name && notYetViewed) {
                    var commentNotifTitle = activity.comment.author.name + ' commented on : "' + activity.pullrequest.title + '"';
                    var notification = new Notification(commentNotifTitle, {
                        icon: activity.comment.author.avatarUrl || window.stashIcon,
                        body: activity.comment.text,
                        eventTime: activity.comment.createdDate,
                        isClickable: true
                    });

                    notification.onclick = function () {
                        window.open(urlUtil.getSiteBaseURl() + urlUtil.buildSlug(activity.pullrequest) + '/overview?commentId=' + activity.comment.id);
                    };
                }

                // notification for subcomments (answers)
                activity.comment.comments.forEach(function (subComment) {
                    displayDesktopNotification([{
                        comment: subComment,
                        pullrequest: activity.pullrequest,
                        wasOwner: activity.wasOwner || activity.comment.author.name === user.name
                    }]);
                });

                // notification for task
                activity.comment.tasks.forEach(function (task) {
                    var taskKey = prefix + 'task_' + task.id;
                    var taskState = localStorage.getItem(taskKey);
                    localStorage.setItem(taskKey, true);

                    var notYetViewed = !(taskState || false).toString().toBool();
                    if (window.notificationType.toString() !== '0' && task.author.name !== user.name && notYetViewed) {
                        var taskNotifTitle = activity.comment.author.name + ' created task on : "' + activity.pullrequest.title + '"';
                        var notification = new Notification(taskNotifTitle, {
                            icon: task.author.avatarUrl || window.stashIcon,
                            body: task.text,
                            eventTime: task.createdDate,
                            isClickable: true
                        });

                        notification.onclick = function () {
                            window.open(urlUtil.getSiteBaseURl() + urlUtil.buildSlug(activity.pullrequest) + '/overview?commentId=' + activity.comment.id);
                        };
                    }

                });
            });
        }

        function addMessagesToolbarIcon() {
            /// toolbar icon
            var button = ['<li class="" title="Last PR messages">',
                '<a href="#inbox-messages" id="inbox-messages" title="Last PR messages">',
                '<span class="aui-icon aui-icon-small aui-iconfont-hipchat"></span>',
                '</a>',
                '</li>'].join('\n');


            jQuery('.help-link').after(button);

            updateUI(false, false, true);
            createCommentsDialog();

            // as desktop notification authorization
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }

            // periodically poll server for update
            if (typeof window.chromeExtId !== 'undefined' && typeof window.chrome !== 'undefined') {
                // use background worker to centralized request and avoid to much server queries
                window.communication.runtime.sendMessage(window.chromeExtId, {
                    action: 'setUrl',
                    url: urlUtil.getSiteBaseURl()
                });

                var activitiesCallback = function (eventArgs) {
                    var activities = filterAnOrderActivities(eventArgs.activities);
                    if (deferredPrRequest.state() !== 'pending') {
                        deferredPrRequest = jQuery.Deferred();
                        deferredPrRequest.resolve(activities);
                        updateUI(false, false, eventArgs.desktopNotification);
                    }
                };
                // chrome
                document.addEventListener('ActivitiesRetrieved', function (eventArgs) {
                    if (window.chromeExtId !== 'stashFF' && eventArgs && eventArgs.detail)
                        activitiesCallback(eventArgs.detail);
                }, false);
                // ff
                window.addEventListener('message', function (eventArgs) {
                    if (eventArgs && eventArgs.data && eventArgs.data.detail)
                        if (eventArgs.data.detail.identifier === 'ActivitiesRetrieved')
                            activitiesCallback(eventArgs.data.detail);
                });
            }
        }

        function markActivitiesAsReadWhenPullRequestOpened() {
            var pr = pageState.getPullRequest();
            if (pr) {
                getLastPRCommentsOnceAsync().done(function (activities) {
                    activities = _.filter(activities, function (a) {
                        return a.pullrequest.id === pr.id;
                    });
                    markActivitiesAsRead(activities, NotificationType.badge);
                    markActivitiesAsRead(activities, NotificationType.panel);
                });
            }
        }

        function checkForUpdate() {
            if (typeof window.chromeExtId !== 'undefined' && typeof window.chrome !== 'undefined') {
                window.communication.runtime.sendMessage(window.chromeExtId, {
                    method: 'GET',
                    action: 'xhttp',
                    url: 'https://raw.githubusercontent.com/rolyv/Stash-Reviewers-Chrome-Extension/master/version'
                }, function (data) {
                    if (!data) {
                        data.response = 'cant.reach.github';
                    }
                    else if ((data.response || {response: ''}).length > 10) {
                        // it's not version file we retrieved
                        data.response = 'cant.check.version';
                    }
                    var currentVersion = window.stashRGEVersion.toString().trim();
                    var newVersion = data.response.toString().trim();
                    var storedVersion = (localStorage.getItem('stashRGEVersion') || '').toString().trim();

                    if (newVersion !== storedVersion && newVersion !== currentVersion) {
                        var body = '<br>Please pull changes with git to update';

                        if (data.response === 'cant.reach.github') {
                            body = "Please check you added your bitbucket server domain to extension manifest.json";
                        }
                        else if (data.response === 'cant.check.version') {
                            body = "Can't connect to github to check version.";
                        }

                        body += '<br><br><a href="https://github.com/rolyv/Stash-Reviewers-Chrome-Extension/blob/master/history" target="_blank">See history (repository)</a>';
                        body += ' <a id="skipVersionLink" href="javascript:window.hideStashRGEVersion();" style="float:right">Skip this version</a>';

                        var flag = auiFlag({
                            type: 'info',
                            title: 'New version of the extension (' + data.response + ')',
                            body: body,
                            close: 'auto'
                        });

                        window.hideStashRGEVersion = function () {
                            localStorage.setItem('stashRGEVersion', newVersion);
                            flag.close();
                        }
                    }
                });
            }
        }

        function removeAnnouncement() {
            if (localStorage.getItem('wittified-banner')) {
                var data = JSON.parse(localStorage.getItem('wittified-banner'));
                var today = new Date().getTime();
                var days = Math.floor((today - data.timestamp) / 1000 / 86400);
                if (days > 6) {
                    localStorage.removeItem('wittified-banner');
                }
                jQuery('section.notifications').remove();
                return;
            }

            var $closeSpan = jQuery('<span class="aui-icon icon-close" role="button" tabindex="0"></span>');
            $closeSpan.click(function () {
                jQuery('section.notifications').remove();
                localStorage.setItem('wittified-banner', JSON.stringify({
                    value: true,
                    timestamp: new Date().getTime()
                }));
            });
            jQuery('section.notifications .aui-message').addClass('closeable').append($closeSpan);
        }

        return {
            addMessagesToolbarIcon: addMessagesToolbarIcon,
            markActivitiesAsReadWhenPullRequestOpened: markActivitiesAsReadWhenPullRequestOpened,
            checkForUpdate: checkForUpdate,
            removeAnnouncement: removeAnnouncement
        }
    });

    define('bitbucket-plugin/pullrequest-list-modifier', [
        'bitbucket/internal/feature/pull-request/pull-request-table'
    ], function (PullRequestsTable) {
        'use strict';
        function redefinePullRequestTable() {
            //redefined filter builder to include new parameters
            PullRequestsTable.prototype.buildUrl = function (start, limit) {
                var self = this;
                var builder = self.getPullRequestsUrlBuilder()
                    .withParams({
                        start: start,
                        limit: limit,
                        avatarSize: bitbucket.internal.widget.avatarSizeInPx({size: 'medium'}),
                        withAttributes: true
                    });

                if (self.prDirection) {
                    builder = builder.withParams({
                        direction: self.prDirection
                    });
                }
                if (self.prSource) {
                    builder = builder.withParams({
                        at: self.prSource
                    });
                }
                if (self.prState) {
                    builder = builder.withParams({
                        state: self.prState
                    });
                }
                if (self.prOrder) {
                    builder = builder.withParams({
                        order: self.prOrder
                    });
                }

                var lastIndex = 0;
                if (self.prAuthors && self.prAuthors.length) {
                    self.prAuthors.forEach(function (u, index) {
                        lastIndex++;
                        var params = {};
                        params["username." + (lastIndex)] = u.name;
                        params["role." + (lastIndex)] = "AUTHOR";
                        builder = builder.withParams(params);
                    });
                }

                if (self.prReviewers && self.prReviewers.length) {
                    self.prReviewers.forEach(function (u, index) {
                        lastIndex++;
                        var params = {};
                        params["username." + (lastIndex)] = u.name;
                        params["role." + (lastIndex)] = "REVIEWER";
                        builder = builder.withParams(params);
                    });
                }

                if (self.prParticipants && self.prParticipants.length) {
                    self.prParticipants.forEach(function (u, index) {
                        lastIndex++;
                        var params = {};
                        params["username." + (lastIndex)] = u.name;
                        params["role." + (lastIndex)] = "PARTICIPANT";
                        builder = builder.withParams(params);
                    });
                }

                if (self.prApprovers && self.prApprovers.length) {
                    self.prApprovers.forEach(function (u, index) {
                        lastIndex++;
                        var params = {};
                        params["username." + (lastIndex)] = u.name;
                        params["approved." + (lastIndex)] = true;
                        params["role." + (lastIndex)] = "REVIEWER";
                        builder = builder.withParams(params);
                    });
                }

                return builder.build();
            };

            var originalRowHandler = PullRequestsTable.prototype.handleNewRows
            PullRequestsTable.prototype.handleNewRows = function (data, attachmentMethod) {
                var self = this;
                originalRowHandler.call(self, data, attachmentMethod);
                var commitList = data.values.map(function (pr) {
                    return {commit: pr.fromRef.latestCommit, prId: pr.id}
                });

                getPRBuildStatus(commitList).done(function (buildDetails) {
                    // add build column
                    if (self.$table.find('th.build-status-pr-list-col').length == 0) {
                        var $buildCol = jQuery('<th>', {
                            class: "build-status-pr-list-col",
                            title: 'Builds',
                            scope: 'col',
                            style: "display: table-cell;",
                            text: 'Builds'
                        });
                        self.$table.find('tr:first').append($buildCol);
                    }

                    var rows = self.$table.find('tr.pull-request-row');
                    rows.each(function (_index, row) {
                        var $row = jQuery(row);
                        if ($row.find('.build-status-pr-list-col-value').length == 0) {
                            var $buildCell = jQuery('<td>', {class: "build-status-pr-list-col-value"});
                            $buildCell.data('pullrequestid', $row.data('pullrequestid'));
                            $row.append($buildCell);
                        }
                    });

                    // add data to build cell
                    var rows = self.$table.find('tr.pull-request-row');
                    buildDetails.forEach(function (buildStatus) {
                        // find row and add build status
                        var cells = jQuery('td.build-status-pr-list-col-value');
                        var cell = cells.filter(function (_, td) {
                            return jQuery(td).data('pullrequestid') == buildStatus.prId
                        });
                        if (cell) {
                            var $buildInfoLink = jQuery('<a>', {
                                href: "#",
                                class: "aui-icon aui-icon-small build-icon",
                                'data-commit-id': buildStatus.commit
                            });

                            var appendIcon = false;
                            if (buildStatus.inProgress) {
                                $buildInfoLink.data('data-build-status', 'INPROGRESS');
                                $buildInfoLink.attr('title', buildStatus.inProgress + ' builds in progress');
                                $buildInfoLink.addClass('aui-iconfont-time');
                                $buildInfoLink.addClass('inprogress-build-icon');
                                appendIcon = true;
                            } else if (buildStatus.failed) {
                                $buildInfoLink.data('data-build-status', 'FAILED');
                                $buildInfoLink.attr('title', buildStatus.failed + ' builds failed');
                                $buildInfoLink.addClass('aui-iconfont-error');
                                $buildInfoLink.addClass('failed-build-icon');
                                appendIcon = true;
                            } else if (buildStatus.successful > 0) {
                                $buildInfoLink.data('data-build-status', 'SUCCESSFUL');
                                $buildInfoLink.attr('title', buildStatus.successful + ' builds passed');
                                $buildInfoLink.addClass('aui-iconfont-approve');
                                $buildInfoLink.addClass('successful-build-icon');
                                appendIcon = true;
                            }

                            if (appendIcon) {
                                cell.html($buildInfoLink);
                                $buildInfoLink.tooltip();
                            }
                        }
                    });
                });
            };
        }

        function getPRBuildStatus(commitList) {
            var commitIds = commitList.map(function (pr) {
                return pr.commit
            });
            return jQuery.ajax('/rest/build-status/latest/commits/stats', {
                method: 'POST',
                headers: {
                    Accept: "application/json, text/javascript, */*;",
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(commitIds),
                dataType: 'json'
            })
                .then(function (data) {
                    jQuery.each(data, function (commitId, info) {
                        var commit = commitList.filter(function (cl) {
                            return cl.commit === commitId
                        });
                        if (commit.length > 0) {
                            jQuery.extend(commit[0], info);
                        }
                    });

                    return commitList;
                });
        }

        return {
            redefinePullRequestTable: redefinePullRequestTable
        }
    });

    define('bitbucket-plugin/pullrequest-list-page', [
        'aui',
        'aui/flag',
        'jquery',
        'lodash',
        'bitbucket/util/events',
        'bitbucket/util/server',
        'bitbucket/util/state',
        'bitbucket/util/navbuilder',
        'bitbucket/internal/feature/pull-request/pull-request-table',
        'bitbucket/internal/widget/searchable-multi-selector',
        'bitbucket/internal/feature/user/user-multi-selector',
        'bitbucket/internal/widget/avatar-list',
        'bitbucket/internal/feature/repository/branch-selector',
        'bitbucket/internal/model/revision-reference'
    ], function (AJS, auiFlag, jQuery, _, events, ajax, pageState, nav, PullRequestsTable, SearchableMultiSelector, UserMultiSelector, avatarList, BranchSelector, revisionReference) {
        'use strict';
        //////////////////////////////////////////////////// Add filter to Pull Request list
        // utilities
        function getParameterByName(name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                results = regex.exec(location.search);
            return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
        }

        function addPrFilters() {
            if (jQuery('#pull-requests-content').length === 0) {
                return;
            }
            jQuery('.spinner').show();

            function getPullRequestsUrlBuilder(state) {
                return nav.rest().currentRepo().allPullRequests().withParams({state: state});
            }

            // recreate table to control it
            var state = getParameterByName('state') || 'OPEN';
            var author = getParameterByName('author') || '';
            var targeting = getParameterByName('at') || '';
            var reviewing = getParameterByName('reviewing') || false;
            // previous values
            var $banchSelectorOrigin = jQuery('#s2id_pr-target-branch-filter');
            var refData = $banchSelectorOrigin.length > 0 ? $banchSelectorOrigin.data('select2').data() : null;
            var $authorFilterOrigin = jQuery('#s2id_pr-author-filter');
            var authorData = $authorFilterOrigin.length > 0 ? $authorFilterOrigin.data('select2').data() : null;

            var order = /*state.toLowerCase() === 'open' ? 'oldest' :*/ 'newest';

            var notFoundMsg = AJS.messages.info({
                title: "No Results",
                body: '<p><a href="?create" class="aui-button aui-button-primary intro-create-pull-request" tabindex="0">Create a new pull request</a></p>',
                closeable: false
            });

            var fakeResult = {
                "size": 0,
                "limit": 0,
                "isLastPage": false,
                "values": [{
                    "id": 8,
                    "version": 2,
                    "title": "loading...",
                    "description": "loading...",
                    "state": "OPEN",
                    "open": false,
                    "closed": true,
                    "createdDate": 1373011695000,
                    "updatedDate": 1373012559000,
                    "locked": false,
                    "author": {
                        "user": {
                            "name": "none",
                            "emailAddress": "none",
                            "id": 16777,
                            "displayName": "none",
                            "active": true,
                            "slug": "none",
                            "type": "NORMAL",
                            "avatarUrl": "#"
                        }, "role": "AUTHOR", "approved": false
                    },
                    "reviewers": [],
                    "participants": [],
                    "attributes": {"resolvedTaskCount": ["0"], "openTaskCount": ["0"]},
                    toRef: {id: 0, displayId: '', repository: {id: 0, slug: '', project: {key: ''}}},
                    fromRef: {id: 0, displayId: '', repository: {id: 0, slug: '', project: {key: ''}}}
                }],
                "start": 0,
                "nextPageStart": 0
            };

            // remove previous
            jQuery(window).off('scroll.paged-scrollable');
            jQuery('#bitbucket-pull-request-table').remove();
            jQuery('.spinner').remove();
            jQuery('.paged-table-message').remove();
            // add container for new
            jQuery('#pull-requests-content').empty();
            jQuery('#pull-requests-content').append('<div id="pull-requests-table-container-filtered"></div>');

            var pullRequestTable = new PullRequestsTable(state, order, getPullRequestsUrlBuilder, {
                noneFoundMessageHtml: notFoundMsg,
                initialData: fakeResult,
                paginationContext: 'pull-request-table-filtered',
                //target: "#pull-requests-table-filtered",
                container: "#pull-requests-table-container-filtered",
                tableMessageClass: "pull-request-table-message-filtered",
                autoLoad: true
            });


            // add missing properties
            pullRequestTable.prAuthors = author && authorData ? [authorData._stash] : [];
            pullRequestTable.prReviewers = reviewing ? [pageState.getCurrentUser()] : [];
            pullRequestTable.prParticipants = [];
            pullRequestTable.prApprovers = [];
            pullRequestTable.prSource = targeting;

            pullRequestTable.init();
            pullRequestTable.update();
            avatarList.init();

            // inject filter UI
            var urlParams = {
                avatarSize: bitbucket.internal.widget.avatarSizeInPx({size: 'xsmall'}),
                permission: 'LICENSED_USER' // filter out non-licensed users
            };
            var dataSource = new SearchableMultiSelector.PagedDataSource(nav.rest().users().build(), urlParams);

            // create form
            var $auiContainer = jQuery('<div class="filter-group-container"></div>');
            var $auiItem = jQuery('<div class="filter-group-content"></div>');
            var $form = jQuery('<form class="aui prevent-double-submit" action="#" method="get" accept-charset="UTF-8"></form>');
            $auiContainer.append($auiItem);
            $auiItem.append($form);

            var $stateSelect = jQuery(['<select name="ddPrState" id="ddPrState">',
                '<option value="OPEN">Open</option>',
                '<option value="MERGED">Merged</option>',
                '<option value="DECLINED">Declined</option>',
                '</select>'].join('\n'));
            $stateSelect.val(pullRequestTable.prState || 'OPEN');
            $form.append($stateSelect);

            var $authorsInput = jQuery('<input class="text" type="text" name="authors" id="authors" placeholder="Authors filter">');
            $form.append($authorsInput);

            var $reviewersInput = jQuery('<input class="text" type="text" name="reviewers" id="reviewers" placeholder="Reviewers filter">');
            $form.append($reviewersInput);

            var $participantsInput = jQuery('<input class="text" type="text" name="participants" id="participants" placeholder="Participants filter">');
            $form.append($participantsInput);

            var $approversInput = jQuery('<input class="text" type="text" name="approvers" id="approvers" placeholder="Approvers filter">');
            $form.append($approversInput);

            var $orderSelect = jQuery(['<select name="ddPrOrder" id="ddPrOrder">',
                '<option value="oldest">Oldest first</option>',
                '<option value="newest">Newest first</option>',
                '</select>'].join('\n'));
            $orderSelect.val(pullRequestTable.prOrder);
            $form.append($orderSelect);

            var $directionSelect = jQuery(['<select name="ddPrDirection" id="ddPrDirection">',
                '<option value="INCOMING">Incoming</option>',
                '<option value="OUTGOING">Outgoing</option>',
                '</select>'].join('\n'));
            $directionSelect.val(pullRequestTable.prDirection || 'INCOMING');
            $form.append($directionSelect);

            var $branchDropdown = jQuery('<button></button>', {
                id: 'prSourceSelector',
                type: 'button',
                class: 'aui-button searchable-selector-trigger revision-reference-selector-trigger sourceBranch',
                title: 'Select branch'
            });
            $branchDropdown.append('<span class="placeholder">Select branch</span>');
            var branchSelector = new BranchSelector($branchDropdown, {
                id: 'prSourceBranchSelector',
                show: {branches: true, tags: false},
                paginationContext: 'branch-filter-selector'
            });
            if (refData) {
                branchSelector.setSelectedItem(new revisionReference({
                    id: refData.id,
                    displayId: refData.display_id,
                    type: refData.type
                }));
            }
            $form.append($branchDropdown);

            new UserMultiSelector($authorsInput, {
                initialItems: pullRequestTable.prAuthors,
                dataSource: dataSource,
                placeholder: "Authors filter"
            }).on("change", function () {
                pullRequestTable.prAuthors = this.getSelectedItems();
                pullRequestTable.update();
            });

            new UserMultiSelector($reviewersInput, {
                initialItems: pullRequestTable.prReviewers,
                dataSource: dataSource,
                placeholder: "Reviewers filter"
            }).on("change", function () {
                pullRequestTable.prReviewers = this.getSelectedItems();
                pullRequestTable.update();
            });

            new UserMultiSelector($participantsInput, {
                initialItems: [],
                dataSource: dataSource,
                placeholder: "Participants filter"
            }).on("change", function () {
                pullRequestTable.prParticipants = this.getSelectedItems();
                pullRequestTable.update();
            });

            new UserMultiSelector($approversInput, {
                initialItems: [],
                dataSource: dataSource,
                placeholder: "Approvers filter"
            }).on("change", function () {
                pullRequestTable.prApprovers = this.getSelectedItems();
                pullRequestTable.update();
            });

            $orderSelect.auiSelect2({minimumResultsForSearch: Infinity, width: 'auto'}).on('change', function (e) {
                pullRequestTable.prOrder = e.val;
                pullRequestTable.update();
            });
            $directionSelect.auiSelect2({minimumResultsForSearch: Infinity, width: 'auto'}).on('change', function (e) {
                pullRequestTable.prDirection = e.val;
                pullRequestTable.update();
            });

            $stateSelect.auiSelect2({minimumResultsForSearch: Infinity, width: 'auto'}).on('change', function (e) {
                pullRequestTable.prState = e.val;
                pullRequestTable.update();
            });

            events.on('bitbucket.internal.feature.repository.revisionReferenceSelector.revisionRefChanged', function (e) {
                pullRequestTable.prSource = e.id;
                pullRequestTable.update();
            });

            events.on('bitbucket.internal.feature.pullRequestsTable.contentAdded', function (data) {
                var $previousStickers = jQuery('#totalResultStamp');

                var previousSize = 0;
                if (data && data.start > 0) {
                    previousSize = parseInt($previousStickers.data('size') || 0);
                }

                $previousStickers.remove();

                var size = (data && data.size ? data.size : 0) + previousSize;
                var $stamps = jQuery('<span id="totalResultStamp" class="aui-lozenge declined aui-lozenge-subtle pull-request-state-lozenge aui-lozenge-complete"></span>')
                    .html('Total: ' + size)
                    .data('size', size);
                jQuery('#prSourceSelector').after($stamps);
            });

            events.on('bitbucket.internal.widget.pagedscrollable.dataLoaded', function (start, limit, data) {
                if (start !== 0) {
                    return;
                }
                var emptyData = {
                    displayId: "All Branches",
                    id: "",
                    isDefault: false
                };
                data.values.splice(0, 0, emptyData);
                branchSelector.scrollableDataStores[0] = branchSelector.scrollableDataStores[0] || [];
                branchSelector.scrollableDataStores[0].splice(0, 0, emptyData);
                if (this.options.paginationContext === 'branch-filter-selector') {
                    this.$scrollElement.find('ul').prepend('<li class="result"><a href="#" data-id="" tabindex="-1"><span class="aui-icon aui-icon-small aui-iconfont-nav-children">Branch</span><span class="name" title="All Branches" data-id="" data-revision-ref="{"id":"","displayId":"All Branches", "isDefault":false,"type":{"id":"branch","name":"Branch"}}">All Branches</span></a></li>');
                }
            });

            // append filter
            jQuery('#pull-requests-content').prepend($auiContainer);

            // fix placeholder bug
            $authorsInput.data('select2').blur();
            $reviewersInput.data('select2').blur();
            $participantsInput.data('select2').blur();
            $approversInput.data('select2').blur();
        }

        return {
            addPrFilters: addPrFilters
        }
    });

    extensionInit();

    function extensionInit() {
        var pageState;
        var loadRequirement = jQuery.Deferred();
        var loadAuiFlag = jQuery.Deferred();
        var loadPrRequirement = jQuery.Deferred();

        try {
            WRM.require("wr!" + 'com.atlassian.auiplugin:aui-flag').then(function (d) {
                loadAuiFlag.resolve();
            });
        }
        catch (_) {
            // optional
            loadAuiFlag.resolve();
        }

        try {
            pageState = require('bitbucket/util/state');
            loadRequirement.resolve();
        }
        catch (_) {
            try {
                WRM.require("wr!" + 'com.atlassian.bitbucket.server.bitbucket-web-api:state').then(function () {
                    pageState = require('bitbucket/util/state');
                    loadRequirement.resolve();
                });
            }
            catch (_) {
                loadRequirement.reject();
            }
        }

        // improve PR page
        try {
            WRM.require("wr!" + 'com.atlassian.bitbucket.server.bitbucket-web:pull-request-table').then(function () {
                require(['bitbucket-plugin/pullrequest-list-modifier'], function (prListModifier) {
                    prListModifier.redefinePullRequestTable();
                    loadPrRequirement.resolve();
                });
            });
        }
        catch (_) {
            loadPrRequirement.resolve();
        }

        jQuery.when(loadRequirement, loadAuiFlag, loadPrRequirement).done(function () {
            var user = pageState.getCurrentUser();
            var project = pageState.getProject();
            var repository = pageState.getRepository();
            var pullRequest = pageState.getPullRequest();

            if (user) {
                require(['bitbucket-plugin/header-notification'], function (notification) {
                    if (window.featuresData.checkversion == 1)
                        notification.checkForUpdate();
                    notification.removeAnnouncement();
                    if (window.featuresData.notifIcon == 1)
                        notification.addMessagesToolbarIcon();

                    if (!project) {
                        // main page
                    }
                    else if (project && !repository) {
                        // project page
                    }
                    else if (project && repository && !pullRequest) {
                        // repository page

                        // PR sticker on branch details page
                        require(['bitbucket-plugin/branch-details-page', 'bitbucket/util/events'], function (branchUtils, events) {
                            if (window.featuresData.forkorigin == 1)
                                branchUtils.addForkOriginLink();
                            if (window.featuresData.sticker == 1)
                                branchUtils.loadPRStickers();
                            if (window.featuresData.checkout == 1)
                                branchUtils.addCheckoutLink();
                            events.on('bitbucket.internal.layout.branch.revisionRefChanged', function (e) {
                                jQuery('#pr-status-wrapper').remove();
                                if (window.featuresData.sticker == 1)
                                    branchUtils.loadPRStickers(e.attributes.id);
                                if (window.featuresData.checkout == 1)
                                    branchUtils.addCheckoutLink(e.attributes.displayId);
                            });
                        });

                        // PR Reviewers groups (create page)
                        require(['bitbucket-plugin/pullrequest-create-page', 'aui'], function (prCreateUtil, AJS) {
                            if (window.featuresData.prtemplate == 1)
                                prCreateUtil.injectTemplateButton(template);
                            if (window.featuresData.reviewersgroup == 1)
                                prCreateUtil.injectReviewersDropdown(jsonGroups);
                        });

                        // PR Filter
                        try {
                            // are we on the pull request list page ? raise exception if not
                            require('bitbucket/internal/feature/pull-request/pull-request-table');

                            // load missing resources
                            var selectorRes = WRM.require("wr!" + 'com.atlassian.bitbucket.server.bitbucket-web:searchable-multi-selector');
                            var userRes = WRM.require("wr!" + 'com.atlassian.bitbucket.server.bitbucket-web:user-multi-selector');
                            var branchSelector = WRM.require("wr!" + 'com.atlassian.bitbucket.server.bitbucket-web:repository-branch-selector');

                            jQuery.when(selectorRes, userRes, branchSelector).done(function () {
                                require(['bitbucket-plugin/pullrequest-list-page'], function (prListUtil) {
                                    if (window.featuresData.prfilters == 1)
                                        prListUtil.addPrFilters();
                                });
                            });
                        }
                        catch (e) {
                            console.warn('not able to load plugin PR filter table', e)
                        }
                    }
                    else if (pullRequest) {
                        require(['bitbucket-plugin/pullrequest-details-page', 'bitbucket-plugin/pullrequest-create-page'], function (prDetailsPage, prCreateUtil) {
                            // Jenkins build link
                            if (window.featuresData.build == 1)
                                prDetailsPage.addBuildLink();
                            // Clickable branch info
                            if (window.featuresData.clickbranch == 1)
                                prDetailsPage.attachNavigateToBranchLink();
                            // Add checkout command link
                            if (window.featuresData.checkout == 1)
                                prDetailsPage.addCheckoutLink();
                            // add conflict warning message
                            if (window.featuresData.prconflicts == 1)
                                prDetailsPage.displayConflicts();
                            // Change notification read state
                            notification.markActivitiesAsReadWhenPullRequestOpened();
                            // replace jira link
                            prDetailsPage.replaceJiraLink();
                            // Reviewers groups (edit page)
                            AJS.bind("show.dialog", function () {
                                if (window.featuresData.prtemplate == 1)
                                    prCreateUtil.injectTemplateButton(template);
                                if (window.featuresData.reviewersgroup == 1)
                                    prCreateUtil.injectReviewersDropdown(jsonGroups);
                            });
                        });
                    }
                });
            }
        });
    }
}());
// Note: to see all bitbucket events add ?eve=* to URL
