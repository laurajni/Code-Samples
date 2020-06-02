/**
 * Builds a query object using the current document object model (DOM).
 * Must use the browser's global document object {@link https://developer.mozilla.org/en-US/docs/Web/API/Document}
 * to read DOM information.
 *
 * @returns query object adhering to the query EBNF
 */
CampusExplorer.buildQuery = function () {
    let query = {};
    let queryForm = document.querySelector("div.tab-panel.active > form");
    const id = queryForm.getAttribute("data-type") + "_";
    query["WHERE"] = buildQueryWhere(queryForm, id);
    query["OPTIONS"] = buildQueryOptions(queryForm, id);
    const groupTransforms = queryForm.querySelectorAll('div.form-group.groups input[checked=checked]');
    const applyTransforms = queryForm.querySelectorAll('div.control-group.transformation');
    if(groupTransforms.length > 0 || applyTransforms.length > 0) {
        query["TRANSFORMATIONS"] = {};
        query["TRANSFORMATIONS"]["GROUP"] = buildGroupTransformations(groupTransforms, id);
        query["TRANSFORMATIONS"]["APPLY"] = buildApplyTransformations(applyTransforms, id);
    }
    return query;
};

function buildQueryWhere(queryForm, id) {
    let conditionType = queryForm.querySelector('div.control-group.condition-type input[checked]');
    if (conditionType== null) {
        return {};
    }
    conditionType = conditionType.getAttribute("value");
    let condition = "";
    if (conditionType === "all") {
        condition = "AND";
    } else if (conditionType === "any") {
        condition = "OR";
    } else if (conditionType === "none") {
        condition = "NOT";
    }
    const filterForms = queryForm.querySelectorAll('div.control-group.condition');
    return buildComparisons(condition, filterForms, id);
}

function parseFilter(filter, id) {
    let parsedFilter = {};
    let selectNotChecked = filter.querySelector("div.control.not > input[checked]");
    selectNotChecked = selectNotChecked!==null; // is false when it is unchecked (when it is null)
    let key = filter.querySelector("div.control.fields option[selected]").getAttribute("value");
    key = id + key;
    const comparator = filter.querySelector("div.control.operators option[selected]")
        .getAttribute("value");
    const inputString = filter.querySelector("div.control.term > input")
        .getAttribute("value");
    let inputKey = inputString;
    if(inputKey == null) {
        inputKey = "";
    }
    if(comparator !== "IS") {
        let inputNum = parseFloat(inputString);
        if (!isNaN(inputNum)) {
            inputKey = inputNum;
        }
    }
    let innerFilter = {};
    innerFilter[key] = {};
    innerFilter[key] = inputKey;
    if(selectNotChecked) {
        parsedFilter["NOT"] = {};
        parsedFilter["NOT"][comparator] = {};
        parsedFilter["NOT"][comparator] = innerFilter;
    } else {
        parsedFilter[comparator] = innerFilter;
    }
    return parsedFilter;
}

function buildQueryOptions(queryForm, id) {
    let options = {};
    let columns = [];
    let order = {};
    let keys = [];
    const columnKeys = queryForm.querySelectorAll('div.form-group.columns div.control.field input[checked]');
    const columnApplyKeys = queryForm.querySelectorAll('div.control.transformation input[checked]');
    for(let column of columnKeys) {
        columns.push(id + column.getAttribute('value'));
    }
    for(let column of columnApplyKeys) {
        columns.push(column.getAttribute('value'));
    }
    options["COLUMNS"] = columns;
    const descendingChecked = queryForm.querySelector('div.control.descending input[checked');
    const orderKeys = queryForm.querySelectorAll
    ('div.control.order.fields option[selected]:not(.transformation)');
    if(descendingChecked==null && orderKeys.length == 0) {
        return options;
    }
    if(descendingChecked == null) {
        order["dir"] = "UP";
    } else {
        order["dir"] = "DOWN";
    }
    const orderApplyKeys = queryForm.querySelectorAll
    ('div.control.order.fields option[selected].transformation');
    for(let order of orderKeys) {
        keys.push(id + order.getAttribute('value'));
    }
    for(let order of orderApplyKeys) {
        keys.push(order.getAttribute('value'));
    }
    order["keys"] = keys;
    options["ORDER"] = order;
    return options;
}

function buildComparisons(conditionType, filterForms, id) {
    let filters = {};
    if(filterForms.length === 1) {
        if (conditionType === "NOT") {
            filters[conditionType] = {}; // is negation
            filters[conditionType] = parseFilter(filterForms[0], id);
        } else {
            filters = parseFilter(filterForms[0], id); //is s or m comparison
        }
    } else if (filterForms.length > 1){
        if (conditionType === "NOT") {
            filters[conditionType] = {};
            filters[conditionType]["OR"] = [];
            for (const filter of filterForms) {
                filters[conditionType]["OR"].push(parseFilter(filter, id));
            }
        } else {
            filters[conditionType] = [];
            for (const filter of filterForms) {
                filters[conditionType].push(parseFilter(filter,id));
            }
        }
    }
    return filters;
}

function buildGroupTransformations(groupTransforms, id) {
    let group = [];
    for(let groupTransform of groupTransforms) {
        group.push(id+groupTransform.getAttribute("value"));
    }
    return group;

}

function buildApplyTransformations(applyTransforms, id) {
    let apply = [];
    for(let applyTransform of applyTransforms) {
        let applyName = applyTransform.querySelector('div.control.term input')
            .getAttribute("value");
        if(applyName == null) {
            applyName = "";
        }
        let comparator = applyTransform.querySelector('div.control.operators option[selected]')
            .getAttribute("value");
        let applyKey = id + applyTransform.querySelector('div.control.fields option[selected]')
            .getAttribute("value");
        let applyObj = {};
        applyObj[applyName] = {};
        applyObj[applyName][comparator] = applyKey;
        apply.push(applyObj);
    }
    return apply;
}
