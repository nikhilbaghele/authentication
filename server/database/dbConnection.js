import mongoose from "mongoose";

export const connection = () => {
    mongoose
        .connect(process.env.MONGO_URI, {
            dbName: "AUTHENTICATION"
        }).then(() => {
            console.log("Connected to Database");
        }).catch((err) => {
            console.log(`Some error occured while connecting to database: ${err}`);
        })
}