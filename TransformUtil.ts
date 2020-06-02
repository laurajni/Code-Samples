import {InsightError} from "./IInsightFacade";
import FilterUtil from "./FilterUtil";
import {Decimal} from "decimal.js";

const stringFieldsC: string[] = ["id", "dept", "instructor", "title", "uuid"];
const numericFieldsC: string[] = ["avg", "pass", "fail", "audit", "year"];
const stringFieldsR: string[] = ["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"];
const numericFieldsR: string[] = ["lat", "lon", "seats"];
const applyTokens: string[] = ["MAX", "MIN", "AVG", "COUNT", "SUM"];


export default class TransformUtil {
    public static transform(results: any[], query: any): Promise<any[]> {
        if (query["TRANSFORMATIONS"] == null ||
            (typeof query["TRANSFORMATIONS"]) !== "object" || query["TRANSFORMATIONS"].constructor === Array) {
            return Promise.reject(new InsightError("TRANSFORMATIONS must be object"));
        } else {
            return TransformUtil.parseTransformations(query["TRANSFORMATIONS"], results)
                .then((transformedGroups) => {
                    return Promise.resolve(transformedGroups);
                }).catch((err) => {
                    return Promise.reject(err);
                });
        }
    }

    public static parseTransformations(query: any, results: any[]): Promise<any[][]> {
        if (Object.keys(query).length !== 2) {
            return Promise.reject(new InsightError("TRANSFORMATIONS has incorrect number of keys"));
        }
        if (!query.hasOwnProperty("GROUP")) {
            return Promise.reject(new InsightError("TRANSFORMATIONS missing GROUP"));
        }
        if (!query.hasOwnProperty("APPLY")) {
            return Promise.reject(new InsightError("TRANSFORMATIONS missing APPLY"));
        }
        if (!query || query["GROUP"] == null || query["GROUP"].constructor !== Array ||
            Object.keys(query["GROUP"]).length < 1) {
            return Promise.reject(new InsightError("GROUP must be a non-empty array"));
        }
        if (!query || query["APPLY"] == null || query["APPLY"].constructor !== Array) {
            return Promise.reject(new InsightError("APPLY must be an array"));
        }
        for (const key of query["GROUP"]) {
            if (!FilterUtil.checkField(key)) {
                return Promise.reject(new InsightError("Group key invalid"));
            }
        }
        let groupedResults = this.getGroups(query["GROUP"], results);
        if (Object.keys(query["APPLY"]).length > 0) {
            return this.applyToGroups(query, groupedResults)
                .then((appliedGroups) => {
                    return Promise.resolve(appliedGroups);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
        } else if (Object.keys(query["APPLY"].length === 0)) {
            return Promise.resolve(groupedResults);
        }
    }

    private static getGroups(groups: string[], results: any[]): any[][] {
        let groupedResults: any[][] = [];
        let currentGroups: string[] = [];
        let keys: string[] = [];
        groups.forEach((groupName) => {
            currentGroups.push(groupName.split("_")[1]);
        });
        results.forEach((item) => {
            let currentKey: any[] = [];
            currentGroups.forEach((key) => {
                currentKey.push((item as any)[key]);
            });
            if (keys.includes(currentKey.toString())) {
                groupedResults[keys.indexOf(currentKey.toString())].push(item);
            } else {
                keys.push(currentKey.toString());
                groupedResults.push([]);
                groupedResults[keys.indexOf(currentKey.toString())].push(item);
            }
        });
        return groupedResults;
    }

    private static applyToGroups(query: any, groupedResults: any[][]): Promise<any[][]> {
        let applyKeys: string[] = [];
        let results = groupedResults;
        for (const applyObj of query["APPLY"]) {
            if (applyObj == null || applyObj.constructor !== Object || Object.keys(applyObj).length !== 1 ||
                applyKeys.includes(Object.keys(applyObj)[0]) || Object.values(applyObj).length !== 1 ||
                (Object.keys(applyObj)[0] === "")) {
                return Promise.reject(new InsightError("Apply Key invalid object or duplicate key"));
            } else {
                let applyKey = Object.keys(applyObj)[0];
                if (new RegExp(/.*_.*/).test(applyKey)) {
                    return Promise.reject(new InsightError("Apply key has invalid characters (underscore)"));
                }
                applyKeys.push(applyKey);
                let tokenObj = Object.values(applyObj)[0];
                let tempResults = this.performApply(applyKey, tokenObj, results);
                if (JSON.stringify(tempResults) === "[[{\"false\":false}]]") {
                    return Promise.reject(new InsightError("something wrong under apply"));
                } else {
                    results = tempResults;
                }
            }
        }
        return Promise.resolve(results);
    }

    private static performApply(applyKey: string, tokenObj: any, groupedResults: any[][]): any[][] {
        if (tokenObj == null || tokenObj.constructor !== Object || Object.keys(tokenObj).length !== 1 ||
            !applyTokens.includes(Object.keys(tokenObj)[0])) {
            return [[{false: false}]];
        }
        if (Object.values(tokenObj)[0] != null && Object.values(tokenObj).length === 1) {
            let tokenKey = Object.values(tokenObj)[0].toString();
            if (FilterUtil.checkField(tokenKey)) {
                tokenKey = tokenKey.split("_")[1];
                if (numericFieldsC.includes(tokenKey) || numericFieldsR.includes(tokenKey)) {
                    if (Object.keys(tokenObj)[0] === "MAX") {
                        for (let sections of groupedResults) {
                            sections.push(this.applyMAX(applyKey, tokenKey, sections));
                        }
                    } else if (Object.keys(tokenObj)[0] === "MIN") {
                        for (let sections of groupedResults) {
                            sections.push(this.applyMIN(applyKey, tokenKey, sections));
                        }
                    } else if (Object.keys(tokenObj)[0] === "AVG") {
                        for (let sections of groupedResults) {
                            sections.push(this.applyAVG(applyKey, tokenKey, sections));
                        }
                    } else if (Object.keys(tokenObj)[0] === "SUM") {
                        for (let sections of groupedResults) {
                            sections.push(this.applySUM(applyKey, tokenKey, sections));
                        }
                    } else if (Object.keys(tokenObj)[0] === "COUNT") {
                        for (let sections of groupedResults) {
                            sections.push(this.applyCOUNT(applyKey, tokenKey, sections));
                        }
                    } else {
                        return [[{false: false}]];
                    }
                    return groupedResults;
                } else if (stringFieldsC.includes(tokenKey) || stringFieldsR.includes(tokenKey)) {
                    if (Object.keys(tokenObj)[0] === "COUNT") {
                        for (let sections of groupedResults) {
                            sections.push(this.applyCOUNT(applyKey, tokenKey, sections));
                        }
                        return groupedResults;
                    } else {
                        return [[{false: false}]];
                    }
                }
            }
        }
        return [[{false: false}]];
    }

    // const applyTokens: string[] = ["MAX", "MIN", "AVG", "COUNT", "SUM"];
    private static applyMAX(applyKey: string, field: string, group: any[]): any {
        let max = -Infinity;
        let ret: { [x: string]: any } = {};
        for (let section of group) {
            if (section[field] !== undefined) {
                if (section[field] > max) {
                    max = section[field];
                }
            }
        }
        ret[applyKey] = max;
        return ret;
    }

    private static applyMIN(applyKey: string, field: any, group: any[]): any {
        let min = Infinity;
        let ret: { [x: string]: any } = {};
        for (let section of group) {
            if (section[field] !== undefined) {
                if (section[field] < min) {
                    min = section[field];
                }
            }
        }
        ret[applyKey] = min;
        return ret;
    }

    private static applyAVG(applyKey: string, field: any, group: any[]): any {
        let total = new Decimal(0);
        let counter = 0;
        let ret: { [x: string]: any } = {};
        for (let section of group) {
            if (section[field] !== undefined) {
                counter++;
                const num = new Decimal(section[field]);
                total = Decimal.add(total, num);
            }
        }
        let avg = total.toNumber() / counter;
        avg = Number(avg.toFixed(2));
        ret[applyKey] = avg;
        return ret;
    }

    private static applyCOUNT(applyKey: string, field: any, group: any[]): any {
        let count = 0;
        let counted: any[] = [];
        for (let section of group) {
            if (!counted.includes(section[field]) && section [field] !== undefined) {
                count++;
                counted.push(section[field]);
            }
        }
        let ret: { [x: string]: any } = {};
        ret[applyKey] = count;
        return ret;
    }

    private static applySUM(applyKey: string, field: any, group: any[]): any {
        let sum = 0;
        let ret: { [x: string]: any } = {};
        for (let section of group) {
            sum += section[field];
        }
        sum = Number(sum.toFixed(2));
        ret[applyKey] = sum;
        return ret;
    }
}
