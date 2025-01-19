# Log Ingestion Service

This project implements a log ingestion service that buffers and batches incoming logs before storing them in S3. The service is built using Node.js, Express, and Kafka.

Github Link : https://github.com/ThiruThanikaiarasu/log-ingestion-server

Docker Image : https://hub.docker.com/r/thiruthanikaiarasu/log-ingestion-server

Hosted Link : http://65.0.128.171:3500

---

## Features

- **Cluster Implementation in Node.js**: Implemented clustering in Node.js to utilize all CPU cores, ensuring the application can handle increased concurrency and make full use of the server's hardware.
- **Buffered Logging with Clustering**: Integrated a buffering mechanism with the cluster, where all worker processes handle input logs, and the master process efficiently batches and pushes these logs to AWS S3.
- **Log Storage in AWS S3**: The processed data from the buffer is stored securely in an AWS S3 bucket for scalable and reliable storage.
- **Edge Case Handling**: If the connection to S3 fails or if the data cannot be stored in S3, the service will retry 3 times. If it still fails, the data will be stored in local storage, and once the service becomes available, the logs will be pushed to S3.
- **Load Test (10k rps) Script**: Wrote a test to shoot 10k requests per second to the /log ingestion endpoint to evaluate the performance under heavy load and ensure stability under high traffic conditions.
- **Load Testing(Custom rps) Script**: A script has been added to simulate load and test the performance of the application under various traffic conditions, ensuring it can handle different volumes of requests.
- **Log Verification Test**: Added a test to check for logs and the number of requests that made logs, ensuring each piece of data is stored perfectly. The test verifies the number of lines (one line per log) present in S3 files against the number of times the /log endpoint was called, ensuring no data is missed.
- **CI/CD with CircleCI**: The Docker image for the project is built and deployed using CircleCI, and the project is hosted on an AWS ECS instance.

---

## Getting Started


### Running Locally

**Step 1. Prerequisites** 

   - Check if Node.js and npm are installed:
       ```bash
       node -v
       npm -v
       ```
 
**Step 2. Clone the Project**
   - Clone the project to your local machine 
       ```bash 
       git clone https://github.com/ThiruThanikaiarasu/log-ingestion-server
       cd log-ingestion-server
       ```

**Step 3. Install Dependencies**
   - Install required npm packages
      ```bash
      npm install
      ```

**Step 5. Set up Environment variable**  
   - Create a .env file in the project root directory with following content
   - Put the value based on the your s3 bucker and local kafka.
      ```env
     PORT=3500
     DB_URL=mongo:connection_string
     SERVER_URL=http://localhost:3500
     BUCKET_NAME=bucker-name
     BUCKET_REGION=region
     BUCKET_ACCESS_KEY=key
     BUCKET_SECRET_KEY=secret

     ```
     
**Step 6. Start the Application**

   - Run the server
     ```bash 
     npm start
     ```

### Run Using Docker 

**Step 1. Prerequesties**
   - Check if Docker is installed
       ```bash
       docker --version
       ```
**Step 2. Pull Docker Image**  
   - If windows user, please make sure you opened Docker Desktop
       ```bash 
       docker pull thiruthanikaiarasu/log-ingestion-server-v2:latest
       ```
       
**Step 3. Set up Environment variable**  
   - Create a .env file in the project root directory with following content
   - Put the value based on the your s3 bucker and local kafka.

**Step 4. Run the Docker Container**
   - Run the Docker using the built image
      ```bash
      docker run -p 3500:3500 --env-file .env log-ingestion-server-v2
      ```
   - To verify that the container is running correctly
      ```bash
      docker ps
      ```
**Step 5. Error Handling and Troubleshooting**
   - If something went worng, like port conflict, permission, or docker error, view logs.
      ```bash
      docker logs <container-name>
      ```
**Step 6. Stopping and Cleaning Up**    
   - To stop and remove the container 
      ```bash
      docker stop <container-name>
      docker rm <container-name>
      ```

---

## Scripts
#### Run Load Test

   - Run LoadTest built using **loadtest package**
      ```bash 
      npm run test-load <number-of-requests>
      ```
   - Replace values like 1000 in place of number-of-request

#### Run Log Test (10k rps)

   - Run Log Test built using script
   - It continuously shoot 10k request to the endpoint. 
      ```bash 
      npm run test-logs <api-endpoint> 
      ```
   - Replace value like http://localhost:3500/api/v1/log in place of api-endpoint.

#### Run Log Test Custom

   - Run Log Test built using script
   - You can specify how many request you need to shoot to endpoint.
      ```bash 
      npm run test-logs-custom <api-endpoint> <number-of-logs>
      ```
   - Replace values like http://localhost:3500/api/v1/log in place of api-endpoint and 100 in place of number-of-logs.

---
Thanks for checking out the project! Let me know if you have any feedback or suggestions.
