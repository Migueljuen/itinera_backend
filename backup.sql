-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: localhost    Database: db_itinera
-- ------------------------------------------------------
-- Server version	8.0.40

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `availability_time_slots`
--

DROP TABLE IF EXISTS `availability_time_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `availability_time_slots` (
  `slot_id` int NOT NULL AUTO_INCREMENT,
  `availability_id` int DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  PRIMARY KEY (`slot_id`),
  KEY `availability_time_slots_ibfk_1` (`availability_id`),
  CONSTRAINT `availability_time_slots_ibfk_1` FOREIGN KEY (`availability_id`) REFERENCES `experience_availability` (`availability_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `availability_time_slots`
--

LOCK TABLES `availability_time_slots` WRITE;
/*!40000 ALTER TABLE `availability_time_slots` DISABLE KEYS */;
INSERT INTO `availability_time_slots` VALUES (1,1,'10:00:00','12:00:00'),(2,1,'12:00:00','14:00:00'),(3,1,'14:00:00','16:00:00'),(4,2,'10:00:00','12:00:00'),(5,2,'12:00:00','14:00:00'),(6,2,'14:00:00','16:00:00'),(7,3,'10:00:00','12:00:00'),(8,3,'12:00:00','14:00:00'),(9,3,'14:00:00','16:00:00'),(10,4,'10:00:00','12:00:00'),(11,4,'12:00:00','14:00:00'),(12,4,'14:00:00','16:00:00'),(13,5,'10:00:00','12:00:00'),(14,5,'12:00:00','14:00:00'),(15,5,'14:00:00','16:00:00'),(16,6,'10:00:00','12:00:00'),(17,6,'12:00:00','14:00:00'),(18,6,'14:00:00','16:00:00'),(19,7,'10:00:00','12:00:00'),(20,7,'12:00:00','14:00:00'),(21,7,'14:00:00','16:00:00'),(22,8,'09:00:00','10:00:00'),(23,8,'10:00:00','11:00:00'),(24,8,'12:00:00','13:00:00'),(25,9,'09:00:00','10:00:00'),(26,9,'10:00:00','11:00:00'),(27,9,'12:00:00','13:00:00'),(28,10,'09:00:00','10:00:00'),(29,10,'10:00:00','11:00:00'),(30,10,'12:00:00','13:00:00'),(31,11,'09:00:00','10:00:00'),(32,11,'10:00:00','11:00:00'),(33,11,'12:00:00','13:00:00'),(34,12,'09:00:00','10:00:00'),(35,12,'10:00:00','11:00:00'),(36,12,'12:00:00','13:00:00'),(37,13,'15:00:00','17:00:00'),(38,13,'10:00:00','12:00:00'),(39,14,'15:00:00','17:00:00'),(40,14,'10:00:00','12:00:00'),(41,15,'15:00:00','17:00:00'),(42,15,'10:00:00','12:00:00'),(43,16,'15:00:00','17:00:00'),(44,16,'10:00:00','12:00:00'),(45,17,'15:00:00','17:00:00'),(46,17,'10:00:00','12:00:00'),(47,18,'16:00:00','18:00:00'),(48,18,'14:00:00','16:00:00'),(49,19,'16:00:00','18:00:00'),(50,19,'14:00:00','16:00:00'),(51,20,'09:00:00','11:00:00'),(52,20,'12:00:00','14:00:00'),(53,20,'15:00:00','17:00:00'),(54,20,'18:00:00','20:00:00'),(55,21,'09:00:00','11:00:00'),(56,21,'12:00:00','14:00:00'),(57,21,'15:00:00','17:00:00'),(58,21,'18:00:00','20:00:00'),(59,22,'17:00:00','20:00:00'),(60,23,'17:00:00','20:00:00'),(61,24,'17:00:00','20:00:00'),(62,25,'17:00:00','20:00:00'),(63,26,'17:00:00','20:00:00'),(64,27,'17:00:00','20:00:00'),(65,28,'17:00:00','20:00:00');
/*!40000 ALTER TABLE `availability_time_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `destination`
--

DROP TABLE IF EXISTS `destination`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `destination` (
  `destination_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `description` text,
  `latitude` decimal(10,6) DEFAULT NULL,
  `longitude` decimal(10,6) DEFAULT NULL,
  PRIMARY KEY (`destination_id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `destination`
--

LOCK TABLES `destination` WRITE;
/*!40000 ALTER TABLE `destination` DISABLE KEYS */;
INSERT INTO `destination` VALUES (1,'Bago River','Bago','A lush, scenic river surrounded by vibrant nature, ideal for an eco-friendly boat tour experience.',10.599000,122.986000),(2,'Silay City Historical District','Silay','Known as the ‘Paris of Negros,’ Silay boasts colonial-era architecture and rich cultural heritage.',10.725000,122.957100),(3,'Talisay Sugar Mill','Talisay','A historic site where you can explore remnants of Talisay\'s sugar industry, a key element of the region\'s economy.',10.727300,123.007700),(4,'Mount Silay','Murcia','A serene mountain location perfect for an intimate bonfire experience, ideal for bonding and relaxation.',10.650000,122.964500),(5,'Bacolod Culinary Arts Center','Bacolod','An interactive cooking space where you can learn local recipes and enjoy the cultural exchange of food-making.',10.676900,122.956500),(6,'Talisay Vineyard','Talisay','A picturesque vineyard offering wine tasting sessions with stunning views of the landscape and mountains.',10.673600,123.006000),(7,'Murcia Waterfalls','Murcia','Discover stunning waterfalls surrounded by tropical forests—perfect for a nature-filled adventure.',10.650000,122.964500),(8,'Bago City Historic Center','Bago','A city known for its history, rich cultural heritage, and colonial-era architecture.',10.599000,122.986000),(9,'MassKara Creative Hub','Bacolod','An artisan space dedicated to preserving and teaching the traditions behind Bacolod’s iconic festival.',10.676500,122.951100),(10,'Silay Wellness Garden','Silay','A tranquil green space offering local healing and botanical wellness activities.',10.803500,122.978100),(11,'Murcia River Bend','Murcia','A natural riverside area perfect for kayaking, picnics, and eco-experiences.',10.557200,123.043100),(12,'Sacred Heritage Trail','Bacolod','A route through Bacolod’s spiritual and historic sites known for their serene ambiance.',10.675400,122.953300),(13,'Talisay Cane Trail','Talisay','A rural farm trail designed for both scenic exploration and unique physical activities.',10.737200,122.974500),(14,'Bago Wetland Reserve','Bago','A protected wetland area rich in birdlife and ideal for nature photography.',10.520200,122.842100),(15,'Silay Cultural Studio','Silay','A creative space in Silay that fosters traditional craftsmanship and artistic interaction.',10.803300,122.978500),(16,'Purok Gago','Bacolod City','haha',10.613717,122.934095),(17,'shit','shit','hahahaha',10.599000,122.986000),(18,'s','s','a',10.725000,122.957100),(19,'hah','Bacolod City','gaha\n',10.615335,122.927375),(20,'test','Bacolod City','test\n',10.612242,122.938232),(21,'Default Destination','Default City','Default Description',0.000000,0.000000),(22,'El Nido Beach','Palawan','One of the best island hopping destinations in the Philippines.',11.202700,119.402400),(23,'haha','Bacolod City','itot',10.615577,122.927350),(24,'purok oplok','Bacolod City','haha',10.616444,122.927921),(25,'z','Bacolod City','z',10.611952,122.940244),(26,'Maedein','Sunnyvale','test',37.391992,-122.038306),(27,'Test destination','Los Altos Hills','tetete',37.369048,-122.133958),(28,'Baywalk Recreational Park','Bacolod City','Near Pope John Paul Tower',10.672422,122.940571),(29,'Blue Ridge Mountains','Asheville','Beautiful mountain range with scenic trails',35.595100,-82.551500),(30,'purok maedein','Bacolod City','haha',10.615319,122.927504),(31,'sio','Bacolod City','sha',10.614467,122.926527),(32,'a','Bacolod City','z',10.612068,122.937353),(33,'shah','Bacolod City','hdhs',10.612251,122.939943),(34,'maedein','Bacolod City','jshsjs',10.613185,122.940427),(35,'szz','Bacolod City','zz',10.613130,122.939608),(36,'Mambukal Resort','Murcia','Mambukal',10.506810,123.108092),(37,'Downtown Bacolod','Bacolod City','Plaza\n',10.669752,122.947020),(38,'Cinco de Noviembre St.','Silay City','Silay',10.793827,122.973282),(39,'Silay Public Market area','Silay City','Silay',10.799457,122.975465),(40,'The Ruins, Talisay','Talisay City','Talisay',10.709098,122.982717);
/*!40000 ALTER TABLE `destination` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `experience`
--

DROP TABLE IF EXISTS `experience`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `experience` (
  `experience_id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text,
  `price` decimal(10,2) DEFAULT NULL,
  `unit` enum('Entry','Hour','Day','Package') DEFAULT NULL,
  `created_at` date DEFAULT NULL,
  `destination_id` int DEFAULT NULL,
  `status` enum('draft','inactive','active') DEFAULT 'draft',
  `travel_companion` enum('Solo','Partner','Family','Friends','Group','Any') DEFAULT NULL,
  PRIMARY KEY (`experience_id`),
  KEY `creator_id` (`creator_id`),
  KEY `experience_ibfk_2` (`destination_id`),
  CONSTRAINT `experience_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `experience_ibfk_2` FOREIGN KEY (`destination_id`) REFERENCES `destination` (`destination_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `experience`
--

LOCK TABLES `experience` WRITE;
/*!40000 ALTER TABLE `experience` DISABLE KEYS */;
INSERT INTO `experience` VALUES (1,12,'Mambukal 7 Falls Trek','Guided trek to explore the waterfalls, with time for a hot spring dip.',200.00,'Entry','2025-05-23',36,'active','Any'),(2,12,'Heritage Waking Tour of Bacolod','Discover historic sites including San Sebastian Cathedral and ancestral homes',75.00,'Day','2025-05-23',37,'active','Family'),(3,12,'Balay Negrense and Heritage Houses Tour','Visit Silay’s iconic ancestral homes and learn about the sugar barons of Negros',100.00,'Entry','2025-05-23',38,'active','Friends'),(4,12,'Silay Cooking Class: Native dishes','Learn to make puto, ibos, and other delicacies with a Silaynon cook.',200.00,'Hour','2025-05-23',39,'active','Any'),(5,12,'The Ruins Night Experience','A guided tour of the famed “Taj Mahal of Negros” with stories and sunset viewing.',150.00,'Entry','2025-05-23',40,'active','Any');
/*!40000 ALTER TABLE `experience` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `experience_availability`
--

DROP TABLE IF EXISTS `experience_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `experience_availability` (
  `availability_id` int NOT NULL AUTO_INCREMENT,
  `experience_id` int DEFAULT NULL,
  `day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') DEFAULT NULL,
  PRIMARY KEY (`availability_id`),
  KEY `experience_id` (`experience_id`),
  CONSTRAINT `experience_availability_ibfk_1` FOREIGN KEY (`experience_id`) REFERENCES `experience` (`experience_id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `experience_availability`
--

LOCK TABLES `experience_availability` WRITE;
/*!40000 ALTER TABLE `experience_availability` DISABLE KEYS */;
INSERT INTO `experience_availability` VALUES (1,1,'Monday'),(2,1,'Tuesday'),(3,1,'Wednesday'),(4,1,'Thursday'),(5,1,'Friday'),(6,1,'Saturday'),(7,1,'Sunday'),(8,2,'Monday'),(9,2,'Wednesday'),(10,2,'Friday'),(11,2,'Saturday'),(12,2,'Sunday'),(13,3,'Monday'),(14,3,'Tuesday'),(15,3,'Wednesday'),(16,3,'Thursday'),(17,3,'Friday'),(18,3,'Saturday'),(19,3,'Sunday'),(20,4,'Sunday'),(21,4,'Saturday'),(22,5,'Sunday'),(23,5,'Saturday'),(24,5,'Friday'),(25,5,'Monday'),(26,5,'Tuesday'),(27,5,'Wednesday'),(28,5,'Thursday');
/*!40000 ALTER TABLE `experience_availability` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `experience_images`
--

DROP TABLE IF EXISTS `experience_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `experience_images` (
  `image_id` int NOT NULL AUTO_INCREMENT,
  `experience_id` int DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`image_id`),
  KEY `experience_id` (`experience_id`),
  CONSTRAINT `experience_images_ibfk_1` FOREIGN KEY (`experience_id`) REFERENCES `experience` (`experience_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `experience_images`
--

LOCK TABLES `experience_images` WRITE;
/*!40000 ALTER TABLE `experience_images` DISABLE KEYS */;
INSERT INTO `experience_images` VALUES (1,1,'uploads/experiences/1747994631435-345650515.jpg','2025-05-23 10:03:51'),(2,2,'uploads/experiences/1747994919001-681812730.jpg','2025-05-23 10:08:39'),(3,3,'uploads/experiences/1747995292822-62972653.jpg','2025-05-23 10:14:53'),(4,4,'uploads/experiences/1747995596954-817320399.jpg','2025-05-23 10:19:57'),(5,5,'uploads/experiences/1747996019731-833295832.jpg','2025-05-23 10:27:01');
/*!40000 ALTER TABLE `experience_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `experience_tags`
--

DROP TABLE IF EXISTS `experience_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `experience_tags` (
  `experience_tag_id` int NOT NULL AUTO_INCREMENT,
  `experience_id` int NOT NULL,
  `tag_id` int NOT NULL,
  PRIMARY KEY (`experience_tag_id`),
  KEY `experience_id` (`experience_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `experience_tags_ibfk_1` FOREIGN KEY (`experience_id`) REFERENCES `experience` (`experience_id`) ON DELETE CASCADE,
  CONSTRAINT `experience_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `experience_tags`
--

LOCK TABLES `experience_tags` WRITE;
/*!40000 ALTER TABLE `experience_tags` DISABLE KEYS */;
INSERT INTO `experience_tags` VALUES (1,1,20),(2,1,15),(3,1,7),(4,1,8),(5,1,19),(6,1,10),(7,1,18),(8,1,13),(9,2,4),(10,2,2),(11,2,3),(12,2,20),(13,2,11),(14,2,15),(15,3,3),(16,3,2),(17,3,11),(18,3,20),(19,3,4),(20,3,15),(21,3,19),(22,4,9),(23,4,15),(24,4,6),(25,4,5),(26,4,2),(27,4,12),(28,4,3),(29,4,4),(30,4,18),(31,4,10),(32,5,10),(33,5,18),(34,5,19),(35,5,9),(36,5,8),(37,5,7),(38,5,17),(39,5,6),(40,5,15),(41,5,20),(42,5,11),(43,5,4),(44,5,3),(45,5,2),(46,5,12);
/*!40000 ALTER TABLE `experience_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `itinerary`
--

DROP TABLE IF EXISTS `itinerary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itinerary` (
  `itinerary_id` int NOT NULL AUTO_INCREMENT,
  `traveler_id` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `notes` text,
  `created_at` date DEFAULT NULL,
  `status` enum('upcoming','ongoing','completed') NOT NULL DEFAULT 'upcoming',
  PRIMARY KEY (`itinerary_id`),
  KEY `fk_traveler_id` (`traveler_id`),
  CONSTRAINT `fk_traveler_id` FOREIGN KEY (`traveler_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `itinerary`
--

LOCK TABLES `itinerary` WRITE;
/*!40000 ALTER TABLE `itinerary` DISABLE KEYS */;
INSERT INTO `itinerary` VALUES (7,2,'2025-06-01','2025-06-10','Summer Adventure in Bacolod','A relaxing trip to enjoy nature and local cuisine.','2025-04-28','upcoming'),(8,9,'2025-06-01','2025-06-03','My Summer Trip to Baguio','Custom schedule with exact times','2025-05-15','upcoming');
/*!40000 ALTER TABLE `itinerary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `itinerary_items`
--

DROP TABLE IF EXISTS `itinerary_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itinerary_items` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `itinerary_id` int NOT NULL,
  `experience_id` int NOT NULL,
  `day_number` int NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `custom_note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  KEY `itinerary_id` (`itinerary_id`),
  KEY `experience_id` (`experience_id`),
  CONSTRAINT `itinerary_items_ibfk_1` FOREIGN KEY (`itinerary_id`) REFERENCES `itinerary` (`itinerary_id`),
  CONSTRAINT `itinerary_items_ibfk_2` FOREIGN KEY (`experience_id`) REFERENCES `experience` (`experience_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `itinerary_items`
--

LOCK TABLES `itinerary_items` WRITE;
/*!40000 ALTER TABLE `itinerary_items` DISABLE KEYS */;
INSERT INTO `itinerary_items` VALUES (1,8,1,1,'09:00:00','11:00:00','Wear hiking shoes','2025-05-15 23:37:08','2025-05-15 23:37:08'),(2,8,2,1,'13:00:00','15:00:00','Take photos','2025-05-15 23:37:08','2025-05-15 23:37:08'),(3,8,3,2,'10:00:00','12:00:00','','2025-05-15 23:37:08','2025-05-15 23:37:08');
/*!40000 ALTER TABLE `itinerary_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `preferences`
--

DROP TABLE IF EXISTS `preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `preferences` (
  `preference_id` int NOT NULL AUTO_INCREMENT,
  `traveler_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `preference_level` enum('Low','Medium','High') NOT NULL,
  PRIMARY KEY (`preference_id`),
  KEY `traveler_id` (`traveler_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `preferences_ibfk_1` FOREIGN KEY (`traveler_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `preferences_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `experience_tags` (`tag_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `preferences`
--

LOCK TABLES `preferences` WRITE;
/*!40000 ALTER TABLE `preferences` DISABLE KEYS */;
INSERT INTO `preferences` VALUES (1,1,2,'High');
/*!40000 ALTER TABLE `preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saved_experiences`
--

DROP TABLE IF EXISTS `saved_experiences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_experiences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `experience_id` int NOT NULL,
  `saved_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `experience_id` (`experience_id`),
  CONSTRAINT `saved_experiences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `saved_experiences_ibfk_2` FOREIGN KEY (`experience_id`) REFERENCES `experience` (`experience_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `saved_experiences`
--

LOCK TABLES `saved_experiences` WRITE;
/*!40000 ALTER TABLE `saved_experiences` DISABLE KEYS */;
INSERT INTO `saved_experiences` VALUES (1,1,2,'2025-05-04 17:32:07');
/*!40000 ALTER TABLE `saved_experiences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `tag_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`tag_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
INSERT INTO `tags` VALUES (1,'Adventure'),(12,'Artistic'),(16,'Beach'),(2,'Budget-Friendly'),(3,'Cultural'),(4,'Family Friendly'),(5,'Foodie'),(20,'Group Travel'),(11,'Historical'),(15,'Local Culture'),(6,'Luxury'),(7,'Nature'),(17,'Nightlife'),(8,'Outdoor'),(9,'Romantic'),(19,'Solo Travel'),(14,'Spa & Relaxation'),(18,'Sustainable'),(10,'Wellness'),(13,'Wildlife');
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `profile_pic` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` enum('Traveler','Creator') NOT NULL DEFAULT 'Traveler',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'John','Dela Cruz','juan.delacruz@example.com','password123','uploads/profile-pics/profile-1745850754675-981981732.png','2025-04-20 20:07:50','Traveler'),(2,'John','Doe','john@example.com','mypassword','uploads/profile-pics/profile-1745853765921-778430254.png','2025-04-20 20:07:50','Traveler'),(3,'Carlos','Reyes','carlos.reyes@example.com','securepass',NULL,'2025-04-20 20:07:50','Traveler'),(4,'Ana','Lopez','ana.lopez@example.com','test1234',NULL,'2025-04-20 20:07:50','Traveler'),(5,'Miguel','Reyes','miguel.reyes@example.com','supersecret',NULL,'2025-04-20 20:07:50','Traveler'),(6,'Miguel','Reyes','miguel@example.com','securepassword',NULL,'2025-04-20 20:31:15','Traveler'),(7,'Miguel','Prado','miguel123@example.com','securepassword123',NULL,'2025-04-20 20:31:28','Traveler'),(8,'John','Doe','john.doe@example.com','$2b$10$l5Kiec4ZfIN7K.ZQkvxq3uGbQ1AhfdAqQaj.OqZzwR8X9L2CWNXWS',NULL,'2025-04-20 20:48:14','Traveler'),(9,'Dexter','Morgan','dexter@gmail.com','$2b$10$Ue1LtpssGzOA18vqheekbeOjfM6QAUSx0BrEVIG/RtvtNkxeDMTqG','uploads/profile-pics/profile-1745857852062-226108357.jpg','2025-04-20 21:40:00','Traveler'),(10,'John','Doe','john.doe123@example.com','$2b$10$vNgTCzkSEAKgz2/UpD/uXeB1KVjWDmTsVATFGRW90F34cM91mH0wa',NULL,'2025-04-27 17:32:04','Creator'),(11,'Miguel','Juen','juenmiguel00@gmail.com','$2b$10$GsOr2bzHYH8/.PKhsS.4SOzS85LUtAip8Sb8kblnQ9N2n3CahVAqK',NULL,'2025-04-28 16:32:31','Creator'),(12,'miguel','juen','miguel@gmail.com','$2b$10$dLPOrFgG2R5gBpcDcJtO5uf620yeFSq.TWK.PwHZU1PK22kY1zilO','uploads/profile-pics/profile-1745858122262-867887142.jpg','2025-04-28 16:34:06','Creator'),(13,'Jaben','Serra','jaben@gmail.com','$2b$10$tza/8LOuJLQsLk7NpW6c1uFWjC6z0PEn1nVTjbr9uCyPLgF3kXdyO',NULL,'2025-05-04 10:57:48','Traveler'),(14,'Maedein','Bajala','maedein@gmail.com','$2b$10$GXCNv78uG1iqOixgA10r.eoWCxVPdRoSLmJce1UJwChB/ZzTQuBOe',NULL,'2025-05-12 07:18:26','Traveler');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-25  2:34:01
