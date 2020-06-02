import Log from "../Util";
import {
    IInsightFacade,
    InsightDataset,
    InsightDatasetKind,
    InsightError,
    NotFoundError,
    ResultTooLargeError
} from "./IInsightFacade";
import * as JSZip from "jszip";
import * as fs from "fs-extra";
import FilterUtil from "./FilterUtil";
import TransformUtil from "./TransformUtil";
import OptionsUtil from "./OptionsUtil";
import Course from "./Course";
import Building from "./Building";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */

class DataSet implements InsightDataset {
    public id: string;
    public kind: InsightDatasetKind;
    public numRows: number;

    constructor(id: string, kind: InsightDatasetKind, numRows: number) {
        this.id = id;
        this.kind = kind;
        this.numRows = numRows;
    }
}

export default class InsightFacade implements IInsightFacade {

    private datasets: InsightDataset[];
    private datasetContents: { [x: string]: any[] };

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
        this.datasets = [];
        this.datasetContents = {};
        let files = fs.readdirSync("./data");
        for (const file of files) {
            const content = fs.readFileSync(`./data/${file}`).toString();
            const data = JSON.parse(content);
            const id = file.split("_")[1];
            const kindStr = file.split("_")[0];
            const kind = kindStr === "courses" ? InsightDatasetKind.Courses :
                kindStr === "rooms" ? InsightDatasetKind.Rooms : null;
            const length = data.length;
            this.datasets.push(new DataSet(id, kind, length));
            this.datasetContents[id] = data;
        }
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        if (new RegExp(/.*_.*/).test(id) || new RegExp(/^\s*$/).test(id) || !id) {
            return Promise.reject(new InsightError("Dataset ID cannot contain underscore or only whitespaces"));
        }
        if (this.datasets.map((dataset) => dataset.id).includes(id)) {
            return Promise.reject(new InsightError(`Dataset with ID ${id} already added`));
        }
        const readZip = JSZip.loadAsync(content, {base64: true});
        if (kind !== InsightDatasetKind.Courses && kind !== InsightDatasetKind.Rooms) {
            return Promise.reject(new InsightError("Invalid kind"));
        }
        let dataPromise: Promise<any[]>;
        if (kind === InsightDatasetKind.Courses) {
            dataPromise = Course.addCourseDataset(id, readZip);
        } else if (kind === InsightDatasetKind.Rooms) {
            dataPromise = Building.addBuildingDataSet(id, readZip);
        }
        return dataPromise.then((data: any[]) => {
            this.datasets.push(new DataSet(id, kind, data.length));
            this.datasetContents[id] = data;
            return Promise.resolve(this.datasets.map((dataset) => dataset.id));
        }, (err) => {
            return Promise.reject(new InsightError(err));
        });
    }

    public removeDataset(id: string): Promise<string> {
        if (new RegExp(/.*_.*/).test(id) || new RegExp(/^\s*$/).test(id) || !id) {
            return Promise.reject(new InsightError("Dataset ID cannot contain underscore or only whitespaces"));
        }
        if (!this.datasets.map((data) => data.id).includes(id)) {
            return Promise.reject(new NotFoundError("Dataset with this ID does not exist"));
        }

        const dataset = this.datasets.find((data) => data.id === id);
        const kind = dataset.kind === InsightDatasetKind.Courses ? "courses" : "rooms";

        return fs.remove(`./data/${kind}_${id}`)
            .then(() => {
                this.datasets = this.datasets.filter((e) => {
                    return e.id !== id;
                });
                delete this.datasetContents[id];
                return Promise.resolve(id);
            })
            .catch((err) => {
                return Promise.reject(new InsightError(err));
            });
    }

    public performQuery(query: any): Promise<any[]> {
        let queryDataset: any[] = [];
        let queryID = "";
        if (!query || query.constructor !== Object) {
            return Promise.reject(new InsightError("Invalid query, must be JSON object"));
        }
        if (Object.keys(query).length > 3) {
            return Promise.reject(new InsightError("Excess keys in query"));
        }
        return FilterUtil.checkFields(FilterUtil.getFields(query), this.datasets)
            .then((id) => {
                queryID = id;
                queryDataset = this.datasetContents[queryID];
                return FilterUtil.getFilter(query);
            })
            .then((filterFunction) => {
                return queryDataset.filter((section) => {
                    return filterFunction(section);
                });
            })
            .then((filteredSections) => {
                if (!query.hasOwnProperty("TRANSFORMATIONS")) {
                    if (Object.keys(query).length === 3) {
                        return Promise.reject(new InsightError("Query has 3rd key that is not TRANSFORMATIONS"));
                    }
                    return filteredSections;
                } else {
                    return TransformUtil.transform(filteredSections, query);
                }
            }).then((groupedSections) => {
                if (!query.hasOwnProperty("TRANSFORMATIONS")) {
                    return OptionsUtil.getBasicOptions(groupedSections, query);
                } else {
                    return OptionsUtil.getTransformedOptions(groupedSections, query);
                }
            }).then((finalResult) => {
                if (finalResult.length > 5000) {
                    return Promise.reject(new ResultTooLargeError(
                        "The result is too big. Only queries with a maximum of 5000 results are supported."));
                } else {
                    return Promise.resolve(finalResult);
                }
            })
            .catch((err) => {
                return Promise.reject(err);
            });
    }

    public listDatasets(): Promise<InsightDataset[]> {
        return Promise.resolve(this.datasets);
    }
}
