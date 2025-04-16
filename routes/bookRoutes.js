import express  from "express";
import cloudinary from "../lib/cloudinary.js";
import Book from "../models/Book.js";
import protectRoute from '../src/middleware/auth.middleware.js';


const router = express.Router();

router.post("/",protectRoute, async (req, res) => {

    try {
        // req.user._id;
        const {title, caption, image, rating} = req.body;

        if(!image || !title || !caption || !rating){
            return res.status(400).json({message: "Please provide all fields"});
        }

        //upload the image to cloudinary
        const uploadResponse = await cloudinary.uploader.upload(image);
        const imageUrl = uploadResponse.secure_url;


        //save the image to database
        const newBook = new Book({
            title,
            caption,
            image: imageUrl,
            rating,
            user: req.user._id
        });

        await newBook.save();
        res.status(201).json(newBook);

    } catch (error) {
        console.log("Error creating book", error);
        res.status(500).json({message: error.message});

    }
})

// const response = await fetch("http://localhost:3000/api/books?page");

//pagination => infinite loading of books
router.get("/", protectRoute, async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = parseInt(req.query.limit) || 2; 
        const skip = (page -1 )* limit;


        const books = await Book.find()
        .sort({createdAt: -1})//desc
        .skip(skip)
        .limit(limit)
        .populate("user", "username profileImage");

        const totalBooks = await Book.countDocuments();

        
        res.send(
            {books,
            currentPage: page,
            totalBooks: totalBooks,
            totalPages: Math.ceil(totalBooks/ limit)}
        );
    } catch (error) {
        console.log("Error in getting books", error);
        res.status(500).json({message: "Can't fetch books"});
    }
})

// get recommended books by the logged in user
router.get("/user", protectRoute, async (req, res) => {
    try {
      const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1 });
      res.json(books);
    } catch (error) {
      console.error("Get user books error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  });
  


//delete the book
router.delete("/:id", protectRoute, async (req, res) => {

    try {
        const book = await Book.findById(req.params.id);
        if(!book) return res.status(404).json({message: "Book not found!"});

        //check if user is the creator of the book
        if(book.user.toString() !== req.user._id.toString())
            return res.status(401).json({message: "Unauthorized"});

        // delete the image from cloudinary as well
        if(book.image && book.image.includes("cloudinary")){
            try {
                const publicId = book.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);

            } catch (deleteError) {
                console.log("Error deleting image from cloudinary", deleteError);
            }
        }

        await book.deleteOne();
        res.json({message: "Book deleted Successfully"});

    } catch (error) {
        console.log("Error deleting book", error);
        res.status(500).json({message: "Internal server error"});
    }
})

export default router;