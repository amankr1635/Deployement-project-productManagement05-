const userModel = require("../models/userModel");
const uploadFile = require("../aws/aws");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { isValidPin, isValidName, isValidEmail, isValidNo, passwordVal, isValidImage, isValidString } = require("../validations/validation");

const user = async function (req, res) {
    try {
        let data = req.body;
        if (req.files.length > 0) data.files = req.files;
        let keys = Object.keys(data);
        let dataArr = ["fname", "lname", "email", "files", "phone", "password", "address"];
        for (let i of dataArr) {
            if (!keys.includes(i))
                return res
                    .status(400)
                    .send({ status: false, message: `${i} field is mandatory ` });
        }
        data.fname = data.fname.trim();
        if (!isValidName(data.fname))
            return res
                .status(400)
                .send({ status: false, message: "fname is Invalid" });
        data.lname = data.lname.trim();
        if (!isValidName(data.lname))
            return res
                .status(400)
                .send({ status: false, message: "lname is Invalid" });
        data.email = data.email.trim().toLowerCase();
        if (!isValidEmail(data.email))
            return res
                .status(400)
                .send({ status: false, message: "email is Invalid" });
        if (!isValidImage(data.files[0].originalname))
            return res.status(400).send({
                status: false,
                message:
                    "Image format is Invalid please provide .jpg or .png or .jpeg format",
            });
        data.phone = data.phone.trim();
        if (!isValidNo(data.phone))
            return res
                .status(400)
                .send({ status: false, message: "phone number is Invalid" });
        let userExist = await userModel.find({
            $or: [{ email: data.email }, { phone: data.phone }],
        });
        if (userExist.length >= 1) {
            if (data.email == userExist[0].email) {
                return res
                    .status(400)
                    .send({ status: false, message: "email is already exist" });
            } else
                return res
                    .status(400)
                    .send({ status: false, message: "phone is already exist" });
        }
        data.password = data.password.trim();
        if (!passwordVal(data.password))
            return res.status(400).send({
                status: false,
                message:
                    "Password must be at least 1 lowercase, at least 1 uppercase,contain at least 1 numeric character , at least one special character, range between 8-15",
            });

        let address = JSON.parse(req.body.address);

        data.address = address;
        if (!address.shipping)
            return res
                .status(400)
                .send({ status: false, message: "shipping field is mandatory" });
        if (!address.shipping.street)
            return res
                .status(400)
                .send({ status: false, message: "Enter shipping street" });
        address.shipping.street = address.shipping.street.trim();
        if (address.shipping.street == "")
            return res.status(400).send({
                status: false,
                message: " shipping street field can't be empty",
            });

        if (!address.shipping.city)
            return res
                .status(400)
                .send({ status: false, message: "Enter shipping city" });
        address.shipping.city = address.shipping.city.trim();
        if (address.shipping.city == "")
            return res.status(400).send({
                status: false,
                message: " shipping city field can't be empty",
            });

        if (!address.shipping.pincode)
            return res
                .status(400)
                .send({ status: false, message: "Enter shipping pincode" });
        if (!isValidPin(address.shipping.pincode))
            return res
                .status(400)
                .send({ status: false, message: "Enter valid pincode in shipping" });

        if (!address.billing)
            return res
                .status(400)
                .send({ status: false, message: "billing field is mandatory" });
        if (!address.billing.street)
            return res
                .status(400)
                .send({ status: false, message: "Enter billing street" });
        address.billing.street = address.billing.street.trim();
        if (address.billing.street == "")
            return res.status(400).send({
                status: false,
                message: " billing street field can't be empty",
            });

        if (!address.billing.city)
            return res
                .status(400)
                .send({ status: false, message: "Enter billing city" });
        address.billing.city = address.billing.city.trim();
        if (address.billing.city == "")
            return res
                .status(400)
                .send({ status: false, message: " billing city field can't be empty" });

        if (!address.billing.pincode)
            return res
                .status(400)
                .send({ status: false, message: "Enter billing pincode" });
        if (!isValidPin(address.billing.pincode))
            return res
                .status(400)
                .send({ status: false, message: "Enter valid pincode in billing" });

        const saltRounds = data.password.length;

        if (data.files && data.files.length > 0) {
            let uploadedFileURL = await uploadFile(data.files[0]);
            data.profileImage = uploadedFileURL;
        } else {
            return res.status(400).send({ msg: "No file found" });
        }
        let hash = await bcrypt.hash(data.password, saltRounds);
        data.password = hash;
        let createUser = await userModel.create(data);
        return res.status(201).send({
            status: true,
            message: "User created successfully",
            data: createUser,
        });
    } catch (error) {
        return res.status(500).send({ status: false, error: error.message });
    }
};

const login = async function (req, res) {
    try {
        let data = req.body;
        if (Object.keys(data).length == 0)
            return res
                .status(400)
                .send({ status: false, msg: "please provide mandatory fields" });
        let { email, password } = data;

        if (!email)
            return res
                .status(400)
                .send({ status: false, message: "please provide email" });
        data.email = data.email.trim().toLowerCase();
        if (!isValidEmail(email))
            return res.status(400).send({ status: false, message: "Invalid email" });

        if (!password)
            return res
                .status(400)
                .send({ status: false, msg: "please provide password" });
        if (!isValidString(password))
            return res.status(400).send({
                status: false,
                msg: "please provide valid password in string",
            });
        password = password.trim();

        if (Object.keys(data).length > 2)
            return res
                .status(400)
                .send({ status: false, msg: "only provide email and password field" });

        let userData = await userModel.findOne({ email: email, isDeleted: false });
        if (!userData)
            return res
                .status(404)
                .send({ status: false, msg: "no user found with this email" });

        bcrypt.compare(data.password, userData.password, (err, pass) => {
            if (err) {
                throw err;
            }
            if (pass) {
                let token = jwt.sign(
                    { userId: userData._id.toString(), emailId: userData.email },
                    "group5californium",
                    { expiresIn: "10h" }
                );
                res.setHeader("x-api-key", token);
                let obj = {};
                obj.userId = userData._id;
                obj.token = token;
                return res
                    .status(200)
                    .send({ status: true, message: "User login successfull", data: obj });
            } else {
                return res
                    .status(400)
                    .send({ status: false, message: "Password is wrong" });
            }
        });
    } catch (error) {
        return res.status(500).send({ status: false, error: error.message });
    }
};

const getUser = async function (req, res) {
    let userId = req.params.userId;

    let user = await userModel.findOne({ _id: userId });
    if (!user)
        return res.status(404).send({ status: false, message: "user not found" });

    return res
        .status(200)
        .send({ status: true, message: "User profile details", data: user });
};


const updateUser = async function (req, res) {
    try {
        let data = req.body;
        if(Object.keys(data).length==0&&!req.files) return res.status(400).send({status:false,message:"please provide some data to update"})
        let userId = req.params.userId;

        if (data.fname) {
            data.fname = data.fname.trim();
            if (!isValidName(data.fname))
                return res
                    .status(400)
                    .send({ status: false, message: "fname is Invalid" });
        }
        if (data.lname) {
            data.lname = data.lname.trim();
            if (!isValidName(data.lname))
                return res
                    .status(400)
                    .send({ status: false, message: "lname is Invalid" });
        }
        if (data.email) {
            data.email = data.email.trim().toLowerCase();
            if (!isValidEmail(data.email))
                return res
                    .status(400)
                    .send({ status: false, message: "email is Invalid" });
        }
        // if(req.files.length == 0) return res.status(400).send({status:false,message:"ProfileImage field can not be empty"})

        if (req.files && req.files.length > 0) {
            data.files = req.files;
            if (!isValidImage(data.files[0].originalname))
                return res.status(400).send({
                    status: false,
                    message:
                        "Image format is Invalid please provide .jpg or .png or .jpeg format",
                });
            if (data.files && data.files.length > 0) {
                let uploadedFileURL = await uploadFile(data.files[0]);
                data.profileImage = uploadedFileURL;
            } else {
                return res.status(400).send({ msg: "No file found" });
            }
        } else { delete data.profileImage }

        if (data.phone) {
            data.phone = data.phone.trim();
            if (!isValidNo(data.phone))
                return res
                    .status(400)
                    .send({ status: false, message: "phone number is Invalid" });
        }
        if (data.email || data.phone) {
            let userExist = await userModel.find({
                $or: [{ email: data.email }, { phone: data.phone }],
            });
            if (userExist.length >= 1) {
                if (data.email == userExist[0].email) {
                    return res
                        .status(400)
                        .send({ status: false, message: "email is already exist" });
                } else
                    return res
                        .status(400)
                        .send({ status: false, message: "phone is already exist" });
            }
        }
        if (data.password) {
            data.password = data.password.trim();
            if (!passwordVal(data.password))
                return res.status(400).send({
                    status: false,
                    message:
                        "Password must be at least 1 lowercase, at least 1 uppercase,contain at least 1 numeric character , at least one special character, range between 8-15",
                });
            const saltRounds = data.password.length;
            let hash = await bcrypt.hash(data.password, saltRounds);
            data.password = hash;
        }
        if (data.address) {
            let address 
            JSON.parse(req.body.address)
            .then((x)=>address=x)
            .catch((err)=> {return res.status(400).send({status:false,message:"Invalid address passed"})})
            let findData = await userModel.findById(userId);
            let address2 = findData.address;

            if (address2) {
                if (address.shipping.street) {
                    address.shipping.street.trim();
                    if (address.shipping.street !== "")
                        address2.shipping.street = address.shipping.street;
                }
                if (address.shipping.city) {
                    address.shipping.city.trim();
                    if (address.shipping.city !== "")
                        address2.shipping.city = address.shipping.city;
                }
                if (address.shipping.pincode) {
                    if (!isValidPin(address.shipping.pincode))
                        return res.status(400).send({
                            status: false,
                            message: "Enter valid pincode in shipping",
                        });
                    address2.shipping.pincode = address.shipping.pincode;
                }
                if (address.billing.street) {
                    address.billing.street.trim();
                    if (address.billing.street !== "")
                        address2.billing.street = address.billing.street;
                }
                if (address.billing.city) {
                    address.billing.city.trim();
                    if (address.billing.city !== "")
                        address2.billing.city = address.billing.city;
                }
                if (address.billing.pincode) {
                    // address.billing.pincode = address.billing.pincode.toString()
                    if (!isValidPin(address.billing.pincode))
                        return res.status(400).send({
                            status: false,
                            message: "Enter valid pincode in billing",
                        });
                    address2.billing.pincode = address.billing.pincode;
                }
            }
            data.address = address2;
        }
        let update = await userModel.findByIdAndUpdate(userId, data, { new: true });
        if (!update)
            return res
                .status(400)
                .send({ status: false, message: "User data not found" });
        return res
            .status(200)
            .send({ status: true, message: "User profile updated", data: update });
    } catch (error) {
        return res.status(500).send({ status: false, error: error.message });
    }
};

module.exports = { user, login, getUser, updateUser };
