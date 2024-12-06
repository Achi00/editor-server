# Package Management and Code Execution API

This API provides functionality for managing Node.js packages and executing code in a sandboxed environment using Docker. It's saves files and installed npm repositories on file system and is able to access them if needed, because of docker all code running environment is secured and independent because for each user it creates new container for user, to run app you have to have .js file, where you can runn app by `Run` button

![App](./app.jpg)

## Functionality

1. **User Authentication and Management**

   - **JWT Authentication**: Secure endpoints using JSON Web Tokens for user authentication.
   - **Email Validation**: User have to validate there email addresses during registration otherwise they can't be authenticated or authorized.
   - **Password Reset/Recovery**: Allow users to reset or recover their passwords via email.

## Mode about authentication

# Email Verification, Password Reset, and Authentication System

- **Email Verification**: Users receive a verification email with a unique link when registering or updating their email. Clicking the link confirms the email, allowing the user to authenticate.

- **Password Reset**: Users can request a password reset by entering their registered email on the reset page. For security:

The email must exist in the database; otherwise, no reset request is sent.

- **Password Reset Rules**:
  - Users can not re-use their old password during the reset process.
  - Password reset url can only be used once

2. **Package Management**

   - Create and update `package.json` files for users
   - Install dependencies using npm
   - Retrieve a list of installed packages

3. **Code Execution**

   - Run JavaScript code in a sandboxed Docker environment
   - Support for both Node.js runtime and jsdom for browser-like environments

   - It determines if code needs jsdom support or not and chooses endpoint to run JavaScript code based on .js file it receives

4. **Code Preview**
   - Because it has jsdom support it can display html dom and can be styled with css
   - Displays logs, errors and messages from dom

## How It Works

### Docker Integration

The API uses Docker to create a sandboxed environment for package installation and code execution. This ensures security and isolation between different user sessions, because it creates different container for each user, container is defined as `container-name-UserID`

- A custom Docker image `nodejs-sandbox` is Node js server which has two endpoints, one is to run only Node js code and other to run js-dom code.
- It first checks if user has running container and if there is container for that user it re uses existing one to cut down run time delay
- The `./helpers/DockerRunners.js` include function which executes commands within Docker container.
- User directories are mounted as volumes in the Docker container to persist data.

### Custom Node.js Server

The API is built on a custom `Node.js` server using `Express.js`.

### Node.js vs jsdom Execution

The system determines whether to use Node.js runtime or jsdom based on the requirements of the code being executed:

- If the code requires browser-like APIs, jsdom is used to simulate a browser environment, for example if in js code user uses any jsdom logic like `document.getElementById("demo").innerText = "Hello"` it will run as a browser environment and user will see html content rendered on right panel.

- For server-side or general JavaScript execution, the Node.js runtime is used.

This decision is typically made based on the presence of browser-specific APIs in the user's code or explicit configuration. one will not work with another endpoint, its same for both cases because when server recives user's code it is wrapper in additional logic and it is stored in new temporary `.js` file, for more info about this, can see:
`./routes/runCodeRoute.js, From line 66`

## Tech Stack

- **Backend**: Node.js with Express.js
- **Package Management**: npm
- **Containerization**: Docker
- **Browser Simulation**: jsdom
- **HTTP Client**: Axios (for npm registry queries)
- **Database**: mysql
- **Authentication**: JWT

## Setup and Running

1. Ensure Docker is installed and running on your system.
2. Build the `nodejs-sandbox` Docker image (Dockerfile should be provided separately).
3. Install Node.js dependencies for the API server:
   `npm install`
4. Run MySQL server
