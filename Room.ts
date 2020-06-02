export default class Room {
    public fullname: string;
    public shortname: string;
    public number: string;
    public name: string;
    public address: string;
    public lat: number;
    public lon: number;
    public seats: number;
    public type: string;
    public furniture: string;
    public href: string;


    constructor(fullName: string, shortName: string,
                rNumber: string, name: string, address: string,
                lat: number, lon: number, seats: number,
                type: string, furniture: string, href: string) {
        this.fullname = fullName;
        this.shortname = shortName;
        this.number = rNumber;
        this.name = name;
        this.address = address;
        this.lat = lat;
        this.lon = lon;
        this.seats = seats;
        this.type = type;
        this.furniture = furniture;
        this.href = href;
    }
}
