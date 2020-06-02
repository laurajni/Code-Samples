import {InsightDataset, InsightError} from "./IInsightFacade";


const stringFieldsC: string[] = ["id", "dept", "instructor", "title", "uuid"];
const numericFieldsC: string[] = ["avg", "pass", "fail", "audit", "year"];
const stringFieldsR: string[] = ["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"];
const numericFieldsR: string[] = ["lat", "lon", "seats"];

export default class FilterUtil {
    private static id: string = "";
    public static checkFields(fields: string[], datasets: InsightDataset[]): Promise<string> {
        this.id = "";
        let passCheck = true;
        for (const field of fields) {
            if (!this.checkField(field)) {
                passCheck = false;
                break;
            }
        }
        if (!passCheck) {
            return Promise.reject(new InsightError("Either query multiple datasets or fields are incorrect"));
        }
        const validIds = datasets.map((dataset) => dataset.id);
        if (!validIds.includes(this.id)) {
            return Promise.reject(new InsightError(`Referenced dataset \"${this.id}\" not added yet`));
        }
        return Promise.resolve(this.id);
    }

    public static checkField(field: string): boolean {
        if (field === null || field === "" || typeof field !== "string") {
            return false;
        }
        let tempId = field.split("_")[0];
        let tempField = field.split("_")[1];

        if (this.id === "") {
            this.id = tempId;
        } else if (this.id !== tempId) {
            return false;
        }
        if (this.id === "courses" && !stringFieldsC.includes(tempField) && !numericFieldsC.includes(tempField)) {
            return false;
        } else if (this.id === "rooms" && !stringFieldsR.includes(tempField) && !numericFieldsR.includes(tempField)) {

            return false;
        }
        return true;
    }

    public static getFields(query: any): string[] {
        let fields: string[] = [];
        for (const item in query) {
            if (item !== "TRANSFORMATIONS" && item !== "ORDER") {
                if (item === "COLUMNS" && query[item].constructor === Array) {
                    for (const key of query[item]) {
                        if (typeof key === "string" && key.includes("_")) {
                            fields.push(key);
                        }
                    }
                } else if ((typeof query[item]) === "string" || (typeof query[item] === "number")) {
                    if (query.constructor === Object) {
                        fields.push(item);
                    } else {
                        fields.push(query[item]);
                    }
                } else {
                    fields = fields.concat(this.getFields(query[item]));
                }
            }
        }
        return fields;
    }

    public static getFilter(query: any): Promise<(section: any) => boolean> {
        if (query.hasOwnProperty("WHERE")) {
            if ((typeof query["WHERE"]) !== "object" || query["WHERE"].constructor === Array) {
                return Promise.reject(new InsightError("WHERE must be object"));
            }
            if (Object.keys(query["WHERE"]).length === 0) {
                return Promise.resolve((x: any) => true);
            }
            return this.buildFilter(query["WHERE"]);
        } else {
            return Promise.reject(new InsightError("Missing WHERE"));
        }
    }

    private static buildFilter(query: any): Promise<(section: any) => boolean> {
        if (!query || query.constructor !== Object || !Object.keys(query) || (Object.keys(query).length !== 1)) {
            return Promise.reject(new InsightError("query is not valid object type"));
        }
        let key = Object.keys(query)[0];
        if (key === "AND" || key === "OR") {
            return this.andOrFilter(query[key], key)
                .then((fun) => {
                    return Promise.resolve(fun);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
        } else {
            if (!(Object.keys(query[key]).length === 1)) {
                return Promise.reject(new InsightError(
                    `${key} should only have 1 key, has ${Object.keys(query[key]).length}`
                ));
            } else if (key === "IS") {
                return FilterUtil.stringFilter(query[key])
                    .then((fun) => {
                        return Promise.resolve(fun);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            } else if (key === "LT" || key === "GT" || key === "EQ") {
                return FilterUtil.numericFilter(query[key], key)
                    .then((fun) => {
                        return Promise.resolve(fun);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            } else if (key === "NOT") {
                if (query["NOT"].constructor === Array) {
                    return Promise.reject(new InsightError(`NOT must be an object`));
                }
                return this.buildFilter(query[key])
                    .then((fun) => {
                        return Promise.resolve((x) => !fun(x));
                    });
            } else {
                return Promise.reject(new InsightError(`Invalid filter key ${key}`));
            }
        }
    }

    private static andOrHelper(filters: Array<(section: any) => boolean>, key: string):
        Promise<(section: any) => boolean> {
        if (key === "AND") {
            return Promise.resolve((x: any) => {
                return filters.every((fun) => fun(x));
            });
        }
        if (key === "OR") {
            return Promise.resolve((x: any) => {
                return filters.some((fun) => fun(x));
            });
        }

    }

    private static andOrFilter(query: any[], key: string): Promise<(section: any) => boolean> {
        if (!query || query.constructor !== Array || Object.keys(query).length < 1) {
            return Promise.reject(new InsightError(`${key} must be a non-empty array`));
        }
        const buildFilters = Promise.all(query.map((filter: any) => {
            return this.buildFilter(filter);
        }));

        return buildFilters
            .then((filters) => {
                return Promise.resolve(this.andOrHelper(filters, key));
            })
            .catch((err) => {
                return Promise.reject(err);
            });
    }

    public static stringFilter(query: any): Promise<(section: any) => boolean> {
        if (!query || query.constructor !== Object) {
            return Promise.reject(new InsightError(`SCOMPARISON must be an object`));
        }
        let [longField, value] = Object.entries(query)[0];
        const field = longField.split("_")[1];
        if ((typeof value) !== "string") {
            return Promise.reject(new InsightError("Invalid value type in IS, should be string"));
        }
        if (!stringFieldsC.includes(field) && !stringFieldsR.includes(field)) {
            return Promise.reject(new InsightError("Invalid key type in IS"));
        }
        const validString = new RegExp(/^\*?[^*]*\*?$/);
        if (!validString.test(value as string)) {
            return Promise.reject(new InsightError(
                "Asterisks (*) can only be the first or last characters of input strings"));
        }
        value = (value as string).replace(/\*/g, ".*");
        try {
            const comparator = new RegExp(`^${value}$`);
            return Promise.resolve((x) => comparator.test((x as any)[field]));
        } catch (err) {
            return Promise.reject(new InsightError(err));
        }
    }

    public static numericFilter(query: any, key: string): Promise<(section: any) => boolean> {
        if (!query || query.constructor !== Object) {
            return Promise.reject(new InsightError(`MCOMPARISON must be an object`));
        }
        const [longField, value] = Object.entries(query)[0];
        const field = longField.split("_")[1];
        if ((typeof value) !== "number") {
            return Promise.reject(new InsightError(`Invalid value type in ${key}, should be number`));
        }
        if (!numericFieldsC.includes(field) && !numericFieldsR.includes(field)) {
            return Promise.reject(new InsightError(`Invalid key type in ${key}`));
        }
        if (key === "LT") {
            return Promise.resolve((x) => (x as any)[field] < value);
        }
        if (key === "GT") {
            return Promise.resolve((x) => (x as any)[field] > value);
        }
        if (key === "EQ") {
            return Promise.resolve((x) => (x as any)[field] === value);
        }
    }


}
