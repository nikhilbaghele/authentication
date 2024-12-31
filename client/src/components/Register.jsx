import React, { useContext } from "react";
import { useForm } from "react-hook-form";
import { Context } from "../main";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";

const Register = () => {
  const { isAuthneticated } = useContext(Context);
  const navigateTo = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const handleRegister = async (data) => {
    data.phone = `+91${data.phone}`;
    await axios.post("http://localhost:4000/api/v1/user/register", data, {
      withCredentials: true,
      headers: { "Content-type": "application/json" },
    })
      .then((res) => {
        toast.success(res.data.message);
        navigateTo(`/otp-verification/${data.email}/${data.phone}`);
      })
      .catch((error) => {
        console.error(error.response.data); // Log the error
        toast.error(error.response.data.message || "An error occurred");
      });
  };

  return (
    <div>
      <form className="auth-form" onSubmit={handleSubmit(handleRegister)}>
        <h2>Register</h2>
        <input
          type="text"
          placeholder="Name"
          {...register("name", { required: "Name is required" })}
        />
        {errors.name && <p className="error">{errors.name.message}</p>}

        <input
          type="email"
          placeholder="Email"
          {...register("email", { required: "Email is required" })}
        />
        {errors.email && <p className="error">{errors.email.message}</p>}

        <div>
          <span>+91</span>
          <input
            type="number"
            placeholder="Phone"
            {...register("phone", { required: "Phone number is required" })}
          />
        </div>
        {errors.phone && <p className="error">{errors.phone.message}</p>}

        <input
          type="password"
          placeholder="Password"
          {...register("password", { required: "Password is required" })}
        />
        {errors.password && <p className="error">{errors.password.message}</p>}

        <div className="verification-method">
          <p>Select verification method</p>
          <div className="wrapper">
            <label>
              <input
                type="radio"
                name="verificationmethod"
                value="email"
                {...register("verificationMethod", { required: "Select a method" })}
              />
              Email
            </label>
            <label>
              <input
                type="radio"
                name="verificationmethod"
                value="phone"
                {...register("verificationMethod", { required: "Select a method" })}
              />
              Phone
            </label>
          </div>
          {/* {errors.verificationmethod && <p className="error">{errors.verificationmethod.message}</p>} */}
        </div>
        <button type="submit">Register</button>
      </form>
    </div>
  );
};

export default Register;
