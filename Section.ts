export default class Section {
    public id: string;
    public dept: string;
    public instructor: string;
    public title: string;
    public uuid: string;
    public avg: number;
    public pass: number;
    public fail: number;
    public audit: number;
    public year: number;
    [key: string]: any;

    constructor(dept: string, id: string, avg: number, instructor: string,
                title: string, pass: number, fail: number, audit: number, uuid: string, year: number) {
        this.dept = dept;
        this.id = id;
        this.avg = avg;
        this.instructor = instructor;
        this.title = title;
        this.pass = pass;
        this.fail = fail;
        this.audit = audit;
        this.uuid = String(uuid);
        this.year = year;
    }
}
