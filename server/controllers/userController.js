import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js"
import { User } from "../models/userModel.js"
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio"
import dotenv from 'dotenv';
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto"

// Specify your custom config file
dotenv.config({ path: './config.env' });

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN)

export const register = catchAsyncError(async (req, res, next) => {
  try {
    const { name, email, phone, password, verificationMethod } = req.body;
    if (!name || !email || !phone || !password || !verificationMethod) {
      return next(new ErrorHandler("All fields are required", 400))
    }

    function validatePhoneNumber(phone) {
      const phoneRegex = /^(?:\+91|091)\d{10}$/
      return phoneRegex.test(phone)
    }

    if (!validatePhoneNumber(phone)) {
      return next(new ErrorHandler("Invalid phone number.", 400))
    }

    const existinguser = await User.findOne({
      $or: [
        {
          email,
          accountVerified: true
        },
        {
          phone,
          accountVerified: true
        }
      ]
    })

    if (existinguser) {
      return next(new ErrorHandler("Phone or email is already used.", 400))
    }

    const registrationAttemptsByUser = await User.find({
      $or: [
        {
          phone,
          accountVerified: false
        },
        {
          email,
          accountVerified: false
        }
      ]
    })

    if (registrationAttemptsByUser.lenght > 3) {
      return next(
        new ErrorHandler(
          "You have exceed the maximum number of attempts (3). Please try again after an hour.",
          400
        )
      )
    }

    const userData = {
      name,
      email,
      phone,
      password
    }

    const user = await User.create(userData)
    const verificationCode = await user.generateVerificationCode()
    await user.save()
    sendVerificationCode(verificationMethod, verificationCode, name, email, phone, res)

  } catch (error) {
    next(error)
  }
})

async function sendVerificationCode(verificationMethod, verificationCode, name, email, phone, res) {
  try {
    if (verificationMethod === "email") {
      const message = generateEmailTemplate(verificationCode)
      sendEmail({ email, subject: "Your verification code", message })
      res.status(200).json({
        success: true,
        message: `Verification email successfully sent to ${name}`
      })
    } else if (verificationMethod === "phone") {
      const verficationCodeWithSpace = verificationCode.toString().split("").join(" ")
      await client.calls.create({
        twiml: `<Response><Say>Your verification code is ${verficationCodeWithSpace}</Say></Response>`,
        from: process.env.TWILIO_PHONE,
        to: phone
      })
      // console.log(verficationCodeWithSpace);

      res.status(200).json({
        success: true,
        message: `OTP sent`
      })
    } else {
      return res.status(500).json({
        success: false,
        message: "Invalid verification method"
      })
    }
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Verification code failed to send"
    })
  }
}

function generateEmailTemplate(verificationCode) {
  return `
        <div
      style={{
        margin: "0",
        padding: "0",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f4f4f4",
        color: "#333",
      }}
    >
      <table
        align="center"
        cellPadding="0"
        cellSpacing="0"
        width="600"
        style={{
          borderCollapse: "collapse",
          backgroundColor: "#ffffff",
          margin: "20px auto",
          borderRadius: "8px",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: "20px",
                textAlign: "center",
                backgroundColor: "#4CAF50",
                color: "#ffffff",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
              }}
            >
              <h1 style={{ margin: 0 }}>Verify Your Email</h1>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "20px", textAlign: "left" }}>
              <p style={{ fontSize: "16px", lineHeight: "1.5" }}>Dear User,</p>
              <p style={{ fontSize: "16px", lineHeight: "1.5" }}>
                Thank you for signing up! To complete your registration, please
                use the verification code below:
              </p>
              <div
                style={{
                  textAlign: "center",
                  margin: "20px 0",
                }}
              >
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#4CAF50",
                    padding: "10px 20px",
                    border: "2px dashed #4CAF50",
                    borderRadius: "4px",
                    display: "inline-block",
                  }}
                >
                  <b>${verificationCode}</b>
                </span>
              </div>
              <p style={{ fontSize: "16px", lineHeight: "1.5" }}>
                If you did not request this, please ignore this email. The code
                will expire in 5 minutes.
              </p>
              <p style={{ fontSize: "16px", lineHeight: "1.5" }}>
                Best regards,
                <br />
                The Support Team
              </p>
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: "20px",
                textAlign: "center",
                backgroundColor: "#f4f4f4",
                color: "#777",
                fontSize: "14px",
                borderBottomLeftRadius: "8px",
                borderBottomRightRadius: "8px",
              }}
            >
              <p style={{ margin: 0 }}>
                &copy; 2024 Authentication Company. All rights reserved.
              </p>
              <p style={{ margin: "5px 0" }}>400001, Mumbai</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    `
}

export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp, phone } = req.body;

  // Validate the phone number
  function validatePhoneNumber(phone) {
    const phoneRegex = /^(?:\+91|091)\d{10}$/;
    return phoneRegex.test(phone);
  }

  if (!validatePhoneNumber(phone)) {
    return next(new ErrorHandler("Invalid phone number.", 400));
  }

  try {
    // Find unverified users
    const userAllEntries = await User.find({
      $or: [
        { email, accountVerified: false },
        { phone, accountVerified: false },
      ],
    }).sort({ createdAt: -1 });

    // If no users are found
    if (!userAllEntries || userAllEntries.length === 0) {
      return next(new ErrorHandler("No unverified user found", 404));
    }

    // Get the most recent entry and delete the rest
    let user = userAllEntries[0];
    if (userAllEntries.length > 1) {
      await User.deleteMany({
        _id: { $ne: user._id },
        $or: [
          { phone, accountVerified: false },
          { email, accountVerified: false },
        ],
      });
    }

    // Check if the user has a verification code
    if (!user.verificationCode) {
      return next(new ErrorHandler("User does not have a verification code.", 400));
    }

    // Validate the OTP
    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("Invalid OTP", 400));
    }

    // Check for OTP expiration
    const currentTime = Date.now();
    const verificationCodeExpire = new Date(user.verficationCodeExpire).getTime();
    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP Expired", 400));
    }

    // Verify the account
    user.accountVerified = true;
    user.verificationCode = null;
    user.verficationCodeExpire = null;
    await user.save({ validateModifiedOnly: true });

    sendToken(user, 200, "Account verified", res);
  } catch (error) {
    console.log("Error: ", error);
    return next(new ErrorHandler("Internal server error", 500));
  }
});


export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body
  if (!email || !password) {
    return next(new ErrorHandler("Email and password is required", 400))
  }

  const user = await User.findOne({ email, accountVerified: true }).select("+password")
  if (!user) {
    return next(new ErrorHandler("Invalid email and password", 400))
  }

  const isPasswordMatched = await user.comparePassword(password)
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email and password", 400))
  }

  sendToken(user, 200, "User logged in successfully", res)
})

export const logout = catchAsyncError(async (req, res, next) => {
  res.status(200).cookie("token", "", {
    expires: new Date(Date.now()),
    httpOnly: true
  }).json({
    success: true,
    message: "Logged out successfully"
  })
})

export const getUser = catchAsyncError(async (req, res, next) => {
  const user = req.user
  res.status(200).json({
    success: true,
    user
  })
})

export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true
  })

  if (!user) {
    return next(new ErrorHandler("User not found", 400))
  }

  const resetToken = user.generateResetPasswordToken()
  await user.save({ validateBeforeSave: false })
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`

  const message = `Your reset token is: \n\n ${resetPasswordUrl} \n\n if you have not request this email then please ignore it.`

  try {
    sendEmail({
      email: user.email,
      subject: "AUTHENTICATION RESET PASSWORD",
      message
    })
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`
    })
  } catch (error) {
    user.resetPasswordToken = undefined,
      user.resetPasswordExpire = undefined,
      await user.save({ validateBeforeSave: false })
    return next(new ErrorHandler(
      error.message ? error.message : "Cannot send reset password token",
      500
    ))
  }
})

export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params
  const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex")
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  })

  if (!user) {
    return next(new ErrorHandler("Reset password is invalid or has been expired", 400))
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Password and confirm password do not match", 400))
  }

  user.password = req.body.password
  user.resetPasswordToken = undefined
  user.resetPasswordExpire = undefined

  await user.save()

  sendToken(user, 200, "Reset Password Successfully", res)
})