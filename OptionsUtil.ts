import {InsightError} from "./IInsightFacade";
import Section from "./Section";
import FilterUtil from "./FilterUtil";

let validGroupKeys: string[] = [];
let validApplyKeys: string[] = [];
let validColumnKeys: string[] = [];

export default class OptionsUtil {
    public static queryColumnsCheck(queryOptions: any): boolean {
        if (!queryOptions.hasOwnProperty("COLUMNS")) {
            return false;
        }
        if (queryOptions["COLUMNS"] == null || !queryOptions || queryOptions["COLUMNS"].constructor !== Array ||
            Object.keys(queryOptions["COLUMNS"]).length < 1) {
            return false;
        }
        return !Object.values(queryOptions["COLUMNS"]).some((key) => {
            return (typeof key !== "string");
        });
    }

    public static getBasicOptions(filteredSections: any[], query: any): Promise<any[]> {
        if (query.hasOwnProperty("OPTIONS")) {
            if (query["OPTIONS"] == null || (typeof query["OPTIONS"]) !== "object" ||
                query["OPTIONS"].constructor === Array || Object.keys(query["OPTIONS"]).length > 2) {
                return Promise.reject(new InsightError("OPTIONS must be object with at most 2 keys"));
            }
            return this.parseOptions(query["OPTIONS"], filteredSections)
                .then((sortedQuery) => {
                    return Promise.resolve(sortedQuery);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
        } else {
            return Promise.reject(new InsightError("Missing OPTIONS"));
        }
    }

    public static parseOptions(query: any, results: any[]): Promise<any[]> {
        if (!this.queryColumnsCheck(query)) {
            return Promise.reject(new InsightError("COLUMNS field in query invalid"));
        }
        let passCheck = true;
        const selectResults = results.map((section: Section) => {
            let ret: { [x: string]: any } = {};
            for (const column of query["COLUMNS"]) {
                if (!FilterUtil.checkField(column)) {
                    passCheck = false;
                    break;
                } else {
                    if (!validColumnKeys.includes(column)) {
                        validColumnKeys.push(column);
                    }
                    const key = column.split("_")[1];
                    ret[column] = (section as any)[key];
                }
            }
            return ret;
        });
        if (!passCheck) {
            return Promise.reject(new InsightError("Column key is invalid"));
        }
        if (!query.hasOwnProperty("ORDER") && Object.keys(query).length >= 2) {
            return Promise.reject(new InsightError("Query has second key that is not ORDER"));
        }
        if (query.hasOwnProperty("ORDER")) {
            return this.sortQuery(query, selectResults)
                .then((sortedQuery) => {
                    return Promise.resolve(sortedQuery);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
        } else {
            return Promise.resolve(selectResults);
        }
    }

    public static sortQuery(query: any, results: Array<{ [p: string]: any }>): Promise<any[]> {
        let orderObj = query["ORDER"];
        if (orderObj == null) {
            return Promise.reject(new InsightError("ORDER is null"));
        } else if (orderObj.constructor === Object && orderObj && orderObj.constructor !== Array &&
            (typeof orderObj) === "object") {
            if (orderObj.hasOwnProperty("dir") && orderObj.hasOwnProperty("keys")) {
                if (orderObj["keys"].constructor !== Array && orderObj["keys"].length < 1) {
                    return Promise.reject(new InsightError("keys in ORDER not an array with at least 1 key"));
                }
                for (const key of orderObj["keys"]) {
                    if (typeof key !== "string" || !FilterUtil.checkField(key) || !validColumnKeys.includes(key)) {
                        return Promise.reject(new InsightError("key in order keys invalid"));
                    }
                }
                return this.getOrder(orderObj, results);
            } else {
                return Promise.reject(new InsightError("Order is an object but not constructed correctly"));
            }
        } else if (typeof orderObj === "string") {
            return this.sortByColumn(query, orderObj, results);
        } else {
            return Promise.reject(new InsightError("Invalid ORDER type"));
        }
    }

    private static getOrder(orderObj: any, results: Array<{ [p: string]: any }>) {
        if (orderObj["dir"] != null && typeof orderObj["dir"] === "string") {
            let orderNumber = 0;
            if (orderObj["dir"] === "UP") {
                orderNumber = 1;
            } else if (orderObj["dir"] === "DOWN") {
                orderNumber = -1;
            } else {
                return Promise.reject(new InsightError("Invalid direction key"));
            }
            return Promise.resolve(this.sortByKeys(results, orderObj["keys"], orderNumber));
        } else {
            return Promise.reject(new InsightError("dir must be a string"));
        }
    }

    public static getTransformedOptions(groupedSections: any[][], query: any) {
        if (query.hasOwnProperty("OPTIONS")) {
            if (query["OPTIONS"] == null || (typeof query["OPTIONS"]) !== "object" ||
                query["OPTIONS"].constructor === Array || Object.keys(query["OPTIONS"]).length > 2) {
                return Promise.reject(new InsightError("OPTIONS must be object with at most 2 keys"));
            }
            return this.parseTransformedOptions(groupedSections, query)
                .then((sortedQuery) => {
                    return Promise.resolve(sortedQuery);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
        } else {
            return Promise.reject(new InsightError("Missing OPTIONS"));
        }
    }

    public static parseTransformedOptions(results: any[][], query: any): Promise<any[]> {
        let queryOptions = query["OPTIONS"];
        let queryTransform = query["TRANSFORMATIONS"];
        if (!this.queryColumnsCheck(queryOptions)) {
            return Promise.reject(new InsightError("COLUMNS field in query invalid"));
        }
        validApplyKeys = [];
        validGroupKeys = queryTransform["GROUP"];
        if (queryTransform["APPLY"].length > 0) {
            for (const applyKey of (queryTransform["APPLY"])) {
                validApplyKeys.push(Object.keys(applyKey)[0]);
            }
        }
        let filteredResults = this.filterGroupsByColumn(results, queryOptions);
        if (filteredResults.includes(false)) {
            return Promise.reject(new InsightError("Column key is invalid"));
        }
        if (!queryOptions.hasOwnProperty("ORDER")) {
            if (Object.keys(queryOptions).length >= 2) {
                return Promise.reject(new InsightError("Query has second key that is not ORDER"));
            } else {
                return Promise.resolve(filteredResults);
            }
        } else {
            return this.sortTransformedQuery(query, filteredResults)
                .then((sortedQuery) => {
                    return Promise.resolve(sortedQuery);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
        }
    }

    private static filterGroupsByColumn(results: any[][], queryOptions: any): any[] {
        let finalResult: any[] = [];
        validColumnKeys = [];
        for (const group of results) {
            let ret: { [x: string]: any } = {};
            for (const section of group) {
                for (let column of queryOptions["COLUMNS"]) {
                    if (!validColumnKeys.includes(column)) {
                        validColumnKeys.push(column);
                    }
                    if (!validGroupKeys.includes(column) && !validApplyKeys.includes(column)) {
                        return finalResult = [false];
                    } else {
                        if (column in section) {
                            ret[column] = section[column];
                        } else if (validGroupKeys.includes(column)) {
                            const key = column.split("_")[1];
                            if (key in section) {
                                ret[column] = section[key];
                            }
                        }
                    }
                }
            }
            finalResult.push(ret);
        }
        return finalResult;
    }

    public static sortTransformedQuery(query: any, results: Array<{ [p: string]: any }>): Promise<any[]> {
        let queryOptions = query["OPTIONS"];
        let orderObj = queryOptions["ORDER"];
        if (orderObj == null) {
            return Promise.reject(new InsightError("ORDER is null"));
        } else if (orderObj.constructor === Object && orderObj && orderObj.constructor !== Array &&
            (typeof orderObj) === "object") {
            if (orderObj.hasOwnProperty("dir") && orderObj.hasOwnProperty("keys")) {
                if (orderObj["keys"] == null || orderObj["keys"] === undefined) {
                    return Promise.reject(new InsightError("ORDER key is null"));
                }
                if (orderObj["keys"].constructor !== Array && orderObj["keys"].length < 1) {
                    return Promise.reject(new InsightError("keys in ORDER not an array with at least 1 key"));
                }
                if (orderObj["keys"].length < 1) {
                    return Promise.reject(new InsightError("empty key"));
                }
                for (const key of orderObj["keys"]) {
                    if (key == null || typeof key !== "string" || !validColumnKeys.includes(key) ||
                        !(validApplyKeys.includes(key) || validGroupKeys.includes(key))) {
                        return Promise.reject(new InsightError("ORDER key not in GROUP OR APPLY or COLUMNS"));
                    }
                }
                return this.getOrder(orderObj, results);
            } else {
                return Promise.reject(new InsightError("Order is an object but not constructed correctly"));
            }
        } else if (typeof orderObj === "string") {
            return this.sortByColumn(queryOptions, orderObj, results);
        } else {
            return Promise.reject(new InsightError("Invalid ORDER type"));
        }
    }

    private static sortByColumn(query: any, orderObj: any, results: Array<{ [p: string]: any }>) {
        if (!query["COLUMNS"].includes(orderObj)) {
            return Promise.reject(new InsightError("ORDER key must be in COLUMNS"));
        }
        return Promise.resolve(results.sort((a, b) => {
            if (a[orderObj] < b[orderObj]) {
                return -1;
            }
            if (a[orderObj] > b[orderObj]) {
                return 1;
            }
            return 0;
        }));
    }

    private static sortByKey(a: any, b: any, keys: string[], dir: number): number {
        let key = keys[0];
        if (a[key] > b[key]) {
            return dir;
        }
        if (a[key] < b[key]) {
            return -1 * dir;
        }
        if (keys.length >= 2) {
            return this.sortByKey(a, b, keys.slice(1, keys.length), dir);
        }
        return 0;
    }

    private static sortByKeys(sections: any[], keys: string[], dir: number): any[] {
        sections.sort((a, b): number => {
            return this.sortByKey(a, b, keys, dir);
        });
        return sections;
    }
}
