const express = require('express');
const app = express();
const bodyParserpress = require('body-parser');
const ejs = require('ejs');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = require('./models/user');
const Reset = require('./models/reset');
const bcrypt = require("bcrypt");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

const randToken = require('rand-token');
const nodemailer = require('nodemailer');

// session
app.use(session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: false
}))
// passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(methodOverride('_method'));


app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});


mongoose.connect("mongodb+srv://oliviertest:1980@cluster-marketplace.jabcp.mongodb.net/cooking?retryWrites=true&w=majority", {
    useNewUrlParser: true, useUnifiedTopology: true
});
// passport local mongoose
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



// ejs

app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: false }));

// models


const Receipe = require('./models/receipe');
const Ingredient = require('./models/ingredient');
const Favourite = require('./models/favourite');
const Schedule = require('./models/schedule');
const user = require('./models/user');

app.listen(3000, function (req, res) {
    console.log('tout marche bien')
})
app.get('/', function (req, res) {
    res.render("index");
})
app.get('/signup', function (req, res) {
    res.render("signup");
})
app.get('/login', function (req, res) {
    res.render("login");
})
app.get('/reset', function (req, res) {
    res.render("reset");
})
app.get('/forgot', function (req, res) {
    res.render("forgot");
})

app.post('/forgot', function (req, res) {
    User.findOne({ username: req.body.username }, function (err, userFound) {
        if (err) {
            console.log(err);
        } else {
            const token = randToken.generate(16);
            Reset.create({
                username: userFound.username,
                resetPasswordToken: token,
                resetPasswordExpires: Date.now() + 3600000
            })
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'cookingcooking162@gmail.com',
                    pass: 'olivier1980'
                }
            });
            const mailOptions = {
                from: 'cookingcooking162@gmail.com',
                to: req.body.username,
                subject: 'link to reset your password',
                text: 'click on this link to reset your password:http://localhost:3000/reset/' + token
            }
            console.log('le mail est pret a partir');

            transporter.sendMail(mailOptions, function (err, response) {
                if (err) {
                    console.log(err);
                } else {
                    res.redirect("/login");
                }
            });
        }
    });
});
app.post('/login', function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (err) {
        if (err) {
            console.log(err)
        } else {
            passport.authenticate("local")(req, res, function () {
                req.flash("success", "congratulations, you are logged in");
                res.redirect("dashboard");
            })
        }
    })
})

app.get("/dashboard", isLoggedIn, function (req, res) {
    res.render("dashboard");
})

app.get("/logout", function (req, res) {
    req.logout();
    req.flash("success", "tank you, you are loggout ");

    res.redirect('/login');
})
// inserer user et mot de passe hash??
app.post('/signup', function (req, res) {

    const newUser = new User({
        username: req.body.username,
    });
    User.register(newUser, req.body.password, function (err, user) {
        if (err) {
            console.log(err)
            res.render('signup');
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("signup");
            })

        }
    });

});

app.get("/reset/:token", function (req, res) {
    Reset.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    }, function (err, obj) {
        if (err) {
            console.log('token expired');
            res.redirect('/login');
        } else {
            res.render('/reset', { token: req.params.token });
        }
    })
})

app.post("/reset/:token", function (req, res) {
    Reset.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function (err, obj) {
        if (err) {
            console.log('token expired');
            res.redirect('/login');
        } else {
            if (req.body.password == req.body.password2) {
                User.findOne({ username: obj.username }, function (err, user) {
                    if (err) {
                        console.log(err);
                    } else {
                        user.setPassword(req.body.password, function (err) {
                            if (err) {
                                console.log(err);

                            } else {
                                user.save();
                                const updateReset = {
                                    resetPasswordToken: null,
                                    resetPasswordExpires: null
                                }
                                Reset.findOneAndUpdate({
                                    resetPasswordToken:
                                        req.params.tocken
                                }, updateReset, function (err, obj1) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        res.redirect('/login');
                                    }
                                }
                                )
                            }
                        });
                    }
                });
            }
        }
    });
});

// receipe route

app.get('/dashboard/myreceipes', isLoggedIn, function (req, res) {
    Receipe.find({
        user: req.user.id
    }, function (err, receipe) {
        if (err) {
            console.log(err);
        } else {
            res.render("receipe", { receipe: receipe });

        }

    })
})

app.get('/dashboard/newreceipe', isLoggedIn, function (req, res) {
    res.render("newreceipe");
});


app.get('/dashboard/myreceipes/:id', function (req, res) {
    Receipe.findOne({ user: req.user.id, _id: req.params.id }, function (err, receipeFound) {
        if (err) {
            console.log(err);

        } else {
            Ingredient.find({
                user: req.user.id,
                receipe: req.params.id
            }, function (err, ingredientFound) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("ingredients", {
                        ingredient: ingredientFound,
                        receipe: receipeFound,

                    });
                }
            })
        }
    })

})

app.post('/dashboard/newreceipe', function (req, res) {
    const newReceipe = {
        name: req.body.receipe,
        image: req.body.logo,
        user: req.user.id,

    }
    Receipe.create(newReceipe, function (err, newReceipe) {
        if (err) {
            console.log(err)
        } else {
            req.flash("success", "new receipe added");
            res.redirect("/dashboard/myreceipes");
        }
    })
});

app.delete('/dashboard/myreceipes/:id', isLoggedIn,function(req, res) {
    Receipe.deleteOne({
        _id: req.params.id}, function(err) {
            if (err) {
                console.log(err)
            } else {
                req.flash("success", "your receipe has been deleted");
                res.redirect('/dashboard/myreceipes');
            }
        })
});

app.get('/dashboard/myreceipes/:id/newingredient', function (req, res) {
    Receipe.findById({ _id: req.params.id }, function (err, found) {
        if (err) {
            console.log(err)
        } else {
            res.render("newingredient", { receipe: found });
        }

    })
})

app.post('/dashboard/myreceipes/:id', function (req, res) {

    const newIngredient = {
        name: req.body.name,
        bestDish: req.body.dish,
        user: req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id
    }
    Ingredient.create(newIngredient, function (err, newIngredient) {
        if (err) {
            console.log(err)
        } else {
            req.flash("success", "your ingredient has been added");
            res.redirect('/dashboard/myreceipes/' + req.params.id);
        }
    })
})


app.delete('/dashboard/myreceipes/:id/:ingredientid', isLoggedIn,function(req, res) {
    Ingredient.deleteOne({
        _id: req.params.ingredientid}, function(err) {
            if (err) {
                console.log(err)
            } else {
                req.flash("success", "your ingredient has been deleted");
                res.redirect('/dashboard/myreceipes/'+req.params.id);
            }
        })
})
// update ingredient
app.post("/dashboard/myreceipes/:id/:ingredientid/edit",isLoggedIn,function(req,res){
Receipe.findOne({user:req.user.id,_id:req.params.id},function(err,receipeFound){
    if(err){
        console.log(err)
    } else {
        Ingredient.findOne({
            _id:req.params.ingredientid,
            receipe:req.params.id
        },function(err,ingredientFound){
            if(err){
                console.log(err)
            } else {
                res.render("edit",{
                    ingredient:ingredientFound,
                    receipe:receipeFound
                })
            }
        })
        }
    })
})


app.put("/dashboard/myreceipes/:id/:ingredientid",isLoggedIn,function(req,res){

const ingredient_update ={
    name:req.body.name,
    bestDish:req.body.dish,
    user:req.user.id,
    quantity:req.body.quantity,
    receipe:req.params.id
}
Ingredient.findByIdAndUpdate({_id:req.params.ingredientid},ingredient_update,function(err,updateIngredient){
    if(err){
        console.log(err);
            } else {
                req.flash("success","Successfully updated ingredient");
                res.redirect('/dashboard/myreceipes/'+ req.params.id);
    }
})
})
// favourite routes

app.get('/dashboard/favourites',isLoggedIn, function (req, res) {
    Favourite.find({user: req.user.id},function(err,favourite){
        if(err){
            console.log(err)
        } else {
            res.render('favourites',{favourite:favourite});
        }
    })
})
app.get('/dashboard/favourites/newfavourite',isLoggedIn, function (req, res) {
            res.render('newfavourite');
        })
app.post('/dashboard/favourites',isLoggedIn, function (req, res) {
        const newFavourite = {
            image:req.body.image,
    title:req.body.title,
    description:req.body.desription,
    user:req.user.id
        }
        Favourite.create(newFavourite,function(err,newFavourite){
            if(err){
                console.log(err)
            } else {
                req.flash('success',"you just added a new favourite");
                res.redirect('/dashboard/favourites');
            }
        })
        })

        app.delete('/dashboard/favourites/:id',isLoggedIn, function (req, res) {
Favourite.deleteOne({_id: req.params.id},function(err){
    if(err){
        console.log(err)
    } else {
        req.flash('success','your favourite has been deleted');
        res.redirect('/dashboard/favourites');
    }
})
        })

// shedule
        app.get('/dashboard/schedule',isLoggedIn, function (req, res) {
            Schedule.find({user: req.user.id},function(err,schedule){
                if(err){
                    console.log(err)
                } else {
                    res.render('schedule',{schedule:schedule});
                }
            })
        })
        app.get('/dashboard/schedule/newschedule',isLoggedIn, function (req, res) {
                    res.render('newSchedule');
                })


        app.post('/dashboard/schedule',isLoggedIn, function (req, res) {
                    const newSchedule = {
                        ReceipeName:req.body.receipename,
                        SheduleDate: req.body.scheduleDate,
                        user:req.user.id,
                        time:req.body.time,
                    }
                    Schedule.create(newSchedule,function(err,newSchedule){
                        if(err){
                            console.log(err)
                        } else {
                           req.flash('success','you just added a new schedule ');
                            res.redirect('/dashboard/schedule');
                        }
                    })
                })

                app.delete('/dashboard/schedule/:id',isLoggedIn, function (req, res) {
                    Schedule.deleteOne({_id: req.params.id},function(err){
                        if(err){
                            console.log(err)
                        } else {
                            req.flash('success','your schedule has been deleted');
                            res.redirect('/dashboard/schedule');
                        }
                    })
                            })



// function de connection
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        req.flash("error", "please login first");
        res.redirect('/login');
    }
}
