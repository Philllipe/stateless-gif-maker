<h1 align="center">Stateless GIF Maker ☁️🖼️</h1>

## About The Project

This was university assignment for _CAB432 - Cloud Computing_. The application is a stateless GIF maker, utilising the persistence services Amazon S3 and SQS, deployed and scaled on the Cloud using Amazon Web Services (AWS). The user can upload a video file to the application and it will be converted to a GIF using FFmpeg and stored in an S3 bucket. The user can then view the GIFs they have created and save them. The application is deployed using an Auto Scaling Group and a Load Balancer with multiple EC2 instances to scale the application based on the amount of CPU utilization (50% target). A queue architecture is used with Amazon SQS to allow the instances to coordinate with each other and take tasks from the queue. 

## Getting Started

An [AWS account](https://aws.amazon.com/) and knowledge of AWS. There will be no instructions for deploying locally. 

The application is configured to use the `ap-southeast-2` region, so make sure to change this if you are using a different region.

The application is also configured to use the a specfic S3 bucket and SQS queue. This will need to be changed to your own bucket and queue. No configurations are needed for the Bucket and Queue, just create them and use the default settings.

## Technologies Used

### Frontend Client

- [Node.js](https://nodejs.org)
- [Express](https://expressjs.com/)
- [AWS SDK](https://aws.amazon.com/sdk-for-node-js/)
- [Tailwind CSS](https://tailwindcss.com/)
  
### Backend Worker

- [Node.js](https://nodejs.org)
- [FFmpeg](https://ffmpeg.org/) & [Fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg)
- [AWS SDK](https://aws.amazon.com/sdk-for-node-js/)
- [PM2](https://pm2.keymetrics.io/)

### AWS Services

- [Amazon S3](https://aws.amazon.com/s3/)
- [Amazon SQS](https://aws.amazon.com/sqs/)
- [Amazon EC2](https://aws.amazon.com/ec2/)
- [Amazon Auto Scaling](https://aws.amazon.com/autoscaling/)
- [Amazon Load Balancer](https://aws.amazon.com/elasticloadbalancing/)
- [Amazon CloudWatch](https://aws.amazon.com/cloudwatch/)

## How To Use
This application is meant to be deployed on the cloud, and therefore running locally was not intended. However it can be run locally by getting the AWS credentials for your account, then adding code to configure the AWS SDK credentials with a .env file or by setting the environment variables in the terminal session.

## Single Instance / No Scaling

1. Launch an EC2 instance (t3.micro was used) using Ubuntu 22.04 LTS with a key pair to login, and make sure the instance is on a public subnet with a public IP address. Use the correct security group to allow HTTP traffic and IAM role to allow access to S3 and SQS.
   
2. Connect into the instance (SSH is recommended) and install Node.js, FFmpeg with the following code:

```sh
$ sudo apt update

$ sudo apt install nodejs

$ sudo apt install npm

$ sudo apt install ffmpeg
```

3. Clone the repository and configure your own S3 bucket and SQS queue in the code:

```sh
# Clone the repository
$ git clone https://github.com/Philllipe/stateless-gif-maker.git

# Go into the repository
$ cd stateless-gif-maker/frontend/routes

# Open the index.js and gif.js files and change the bucket, queue names, and regions to your own
$ nano index.js 
$ nano gif.js

# Do the same for the backend worker
$ cd ../worker
$ nano worker.js
```

4. Go into the worker directory, install the dependencies and start the backend worker:

```sh
$ cd stateless-gif-maker/worker

$ npm install

$ npm start # This will start the backend worker
```

5. Verify the worker is running correctly by going to the public IP address of the instance on port `8000`. You should see a message saying "Worker is running".
   
6. Open another terminal session and connect to the instance again. This terminal session will be used for the frontend client, while the other is being used for the backend worker.
   
7. Go into the client directory and install the dependencies and start the frontend client:

```sh
$ cd stateless-gif-maker/client

$ npm install

$ npm start # This will start the frontend client
```

8. Verify the frontend client is running correctly by going to the public IP address of the instance on port `3000`. You should see the application running.

9. You can now upload a video file and convert it to a GIF. The GIF will be stored in the S3 bucket you configured.

## Auto Scaling

We will use a single EC2 instance for the frontend, then scale out the workers using an Auto Scaling Group.

1. Follow the steps for a single instance but only for the frontend. You can use a t2.micro instance for this. Optionally remove the other directory (worker) from the instance.

```sh
$ rm -rf worker
```

2. Launch another EC2 instance (t3.micro was used) and follow the steps for a single instance but only for the backend worker. A t3.micro instance was used for this. Optionally remove the other directory (client) from the instance.

```sh
$ rm -rf client
```

3. Install PM2 on the backend worker instance:

```sh
$ sudo npm install pm2 -g
```

4. Start the backend worker using PM2 from the worker directory, then save the process list so it will start on reboot:

```sh
$ cd stateless-gif-maker/worker

$ pm2 startup 

$ pm2 start worker.js # this uses the ecosystem.config.js file

$ pm2 save

$ pm2 list # verify the worker is running
```

5. Verify this works by restarting the instance, then going to the public IP address of the instance on port `8000`. You should the message "Worker is running".

6. Create an **AMI** of the backend worker instance. This will be used for the _Auto Scaling Group_.

7. Create a **Target Group** that is configured to use HTTP on port `8000`.

8. Create an **Application Load Balancer** that is configured to listen on port `80` and the Target group you created.

9. Create a **Launch Configuration** that uses the AMI you created and the same security group as the backend worker instance. Make sure to configure the IAM role to allow access to S3 and SQS.

10. Create an **Auto Scaling Group** that uses the Launch Configuration you created, and the Target Group you created. Configure the Auto Scaling Group to use the same security group as the backend worker instance. Set the minimum instances to `1` and the maximum instances to `5`. Configure the scaling policy to use CPU utilization as the metric, with a target of `50%`.

11. Verify this works by going to Load Balancer's DNS name on port `8000`. You should see the application running.

12. You can now upload a video file and convert it to a GIF using the first instance. The GIF will be stored in the S3 bucket you configured and more instances will be added to the Auto Scaling Group if the CPU utilization is above `50%`.




