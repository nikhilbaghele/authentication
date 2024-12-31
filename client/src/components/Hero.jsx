import React, { useContext } from "react";
import "../styles/Hero.css";
import { Context } from "../main";

const Hero = () => {
  const { user } = useContext(Context);
  return (
    <>
      <div className="hero-section">
        <h4>Hello, {user ? user.name : "Developer"}</h4>
        <h1>Welcome to MERN Authentication</h1>
      </div>
    </>
  );
};

export default Hero;
