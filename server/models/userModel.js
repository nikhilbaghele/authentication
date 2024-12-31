import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import crypto from "crypto"

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: {
        type: String,
        minLength: [8, "Password must have at least 8 characters."],
        maxLength: [32, "Password cannot have more than 32 characters."],
        select: false
    },
    phone: String,
    accountVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: Number,
    verficationCodeExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
})

userSchema.pre("save", async function (next) {
    try {
        if (!this.isModified("password")) {
            return next();
        }
        this.password = await bcrypt.hash(this.password, 10);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

userSchema.methods.generateVerificationCode = function () {
    function generateRandomFiveNumbers() {
        const firstDigit = Math.floor(Math.random() * 9) + 1;
        const remainingDigits = Math.floor(Math.random() * 10000).toString().padStart(4, 0)
        return parseInt(firstDigit + remainingDigits)
    }

    const verificationCode = generateRandomFiveNumbers()
    this.verificationCode = verificationCode
    this.verficationCodeExpire = Date.now() + 10 * 60 * 1000
    return verificationCode
}

userSchema.methods.generateToken = function () {
    return jwt.sign(
        { id: this._id },
        process.env.JWT_SECRET_KEY,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

userSchema.methods.generateResetPasswordToken = function (){
    const resetToken = crypto.randomBytes(20).toString("hex")

    this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex")
    this.resetPasswordExpire = Date.now() + 15 * 60 * 1000
    return resetToken   
}

export const User = mongoose.model("User", userSchema)