/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: gear
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `SequelizeMeta`
--

DROP TABLE IF EXISTS `SequelizeMeta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `SequelizeMeta` (
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SequelizeMeta`
--

LOCK TABLES `SequelizeMeta` WRITE;
/*!40000 ALTER TABLE `SequelizeMeta` DISABLE KEYS */;
INSERT INTO `SequelizeMeta` VALUES
('00_addAuthorizationServer.js');
/*!40000 ALTER TABLE `SequelizeMeta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academy_videos`
--

DROP TABLE IF EXISTS `academy_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `academy_videos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `duration` varchar(20) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academy_videos`
--

LOCK TABLES `academy_videos` WRITE;
/*!40000 ALTER TABLE `academy_videos` DISABLE KEYS */;
INSERT INTO `academy_videos` VALUES
(1,'basics','Updated Title','5:20','https://www.youtube.com/embed/dQw4w9WgXcQ','Deploying Docker containers in schools.','2026-01-29 05:20:03'),
(2,'basics','Navigating the 3D Repo','3:15','https://www.youtube.com/embed/dQw4w9WgXcQ','Finding and filtering VET models.','2026-01-29 05:20:03'),
(3,'creation','Creating Your First Lesson','8:45','https://www.youtube.com/embed/dQw4w9WgXcQ','Using the Workbook Editor.','2026-01-29 05:20:03'),
(4,'creation','Adding Interactive Hotspots','4:30','https://www.youtube.com/embed/dQw4w9WgXcQ','Attaching media to 3D parts.','2026-01-29 05:20:03'),
(5,'pedagogy','Bloom\'s Taxonomy in VR','12:00','https://www.youtube.com/embed/dQw4w9WgXcQ','Structuring learning outcomes.','2026-01-29 05:20:03'),
(6,'pedagogy','Flipped Classroom with GEAR','9:10','https://www.youtube.com/embed/dQw4w9WgXcQ','Assigning VR homework.','2026-01-29 05:20:03');
/*!40000 ALTER TABLE `academy_videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accesstokens`
--

DROP TABLE IF EXISTS `accesstokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `accesstokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `platformUrl` text DEFAULT NULL,
  `clientId` text DEFAULT NULL,
  `scopes` text DEFAULT NULL,
  `iv` text DEFAULT NULL,
  `data` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accesstokens_platform_url_client_id_scopes` (`platformUrl`(50),`clientId`(50),`scopes`(50)),
  KEY `accesstokens_created_at` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accesstokens`
--

LOCK TABLES `accesstokens` WRITE;
/*!40000 ALTER TABLE `accesstokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `accesstokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `analytics_logs`
--

DROP TABLE IF EXISTS `analytics_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `analytics_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) DEFAULT NULL,
  `lesson_id` varchar(255) DEFAULT NULL,
  `model_id` varchar(255) DEFAULT NULL,
  `position` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`position`)),
  `target` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`target`)),
  `duration` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `analytics_logs`
--

LOCK TABLES `analytics_logs` WRITE;
/*!40000 ALTER TABLE `analytics_logs` DISABLE KEYS */;
INSERT INTO `analytics_logs` VALUES
(1,'student1','lesson1','model-1','{\"x\":0,\"y\":0,\"z\":0}','{\"x\":0.5,\"y\":0.5,\"z\":0}',2000,'2026-01-26 00:59:16');
/*!40000 ALTER TABLE `analytics_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contexttokens`
--

DROP TABLE IF EXISTS `contexttokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `contexttokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contextId` text DEFAULT NULL,
  `path` text DEFAULT NULL,
  `user` text DEFAULT NULL,
  `roles` text DEFAULT NULL,
  `targetLinkUri` text DEFAULT NULL,
  `context` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`context`)),
  `resource` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`resource`)),
  `custom` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom`)),
  `endpoint` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`endpoint`)),
  `namesRoles` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`namesRoles`)),
  `lis` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`lis`)),
  `launchPresentation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`launchPresentation`)),
  `messageType` text DEFAULT NULL,
  `version` text DEFAULT NULL,
  `deepLinkingSettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`deepLinkingSettings`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `contexttokens_context_id_user` (`contextId`(50),`user`(50)),
  KEY `contexttokens_created_at` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contexttokens`
--

LOCK TABLES `contexttokens` WRITE;
/*!40000 ALTER TABLE `contexttokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `contexttokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hotspots`
--

DROP TABLE IF EXISTS `hotspots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `hotspots` (
  `id` varchar(50) NOT NULL,
  `model_id` varchar(50) DEFAULT NULL,
  `position` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`position`)),
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `mediaUrl` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `model_id` (`model_id`),
  CONSTRAINT `hotspots_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `models` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hotspots`
--

LOCK TABLES `hotspots` WRITE;
/*!40000 ALTER TABLE `hotspots` DISABLE KEYS */;
INSERT INTO `hotspots` VALUES
('hs-48ngq','6jwihtagv','{\"x\":0,\"y\":1,\"z\":0}','New Hotspot','Educational info goes here.','info',NULL);
/*!40000 ALTER TABLE `hotspots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `idtokens`
--

DROP TABLE IF EXISTS `idtokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `idtokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `iss` text DEFAULT NULL,
  `platformId` text DEFAULT NULL,
  `clientId` text DEFAULT NULL,
  `deploymentId` text DEFAULT NULL,
  `user` text DEFAULT NULL,
  `userInfo` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`userInfo`)),
  `platformInfo` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`platformInfo`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idtokens_iss_client_id_deployment_id_user` (`iss`(50),`clientId`(50),`deploymentId`(50),`user`(50)),
  KEY `idtokens_created_at` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `idtokens`
--

LOCK TABLES `idtokens` WRITE;
/*!40000 ALTER TABLE `idtokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `idtokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lesson_attempts`
--

DROP TABLE IF EXISTS `lesson_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lesson_attempts` (
  `id` varchar(255) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `lesson_id` varchar(255) NOT NULL,
  `status` enum('started','completed') DEFAULT 'started',
  `score` int(11) DEFAULT 0,
  `last_step` int(11) DEFAULT 0,
  `started_at` timestamp NULL DEFAULT current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `lesson_id` (`lesson_id`),
  CONSTRAINT `lesson_attempts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lesson_attempts_ibfk_2` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lesson_attempts`
--

LOCK TABLES `lesson_attempts` WRITE;
/*!40000 ALTER TABLE `lesson_attempts` DISABLE KEYS */;
INSERT INTO `lesson_attempts` VALUES
('att-1769975862695','user-001','lesson-1769212602954','started',100,8,'2026-02-01 19:57:42','2026-02-03 06:13:22');
/*!40000 ALTER TABLE `lesson_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lesson_steps`
--

DROP TABLE IF EXISTS `lesson_steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lesson_steps` (
  `id` varchar(50) NOT NULL,
  `lesson_id` varchar(50) NOT NULL,
  `step_order` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `model_id` varchar(50) DEFAULT NULL,
  `hotspot_id` varchar(50) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `interaction_type` enum('read','find_part','quiz') DEFAULT 'read',
  `interaction_data` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lesson_id` (`lesson_id`),
  KEY `model_id` (`model_id`),
  KEY `hotspot_id` (`hotspot_id`),
  CONSTRAINT `lesson_steps_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lesson_steps_ibfk_2` FOREIGN KEY (`model_id`) REFERENCES `models` (`id`) ON DELETE SET NULL,
  CONSTRAINT `lesson_steps_ibfk_3` FOREIGN KEY (`hotspot_id`) REFERENCES `hotspots` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lesson_steps`
--

LOCK TABLES `lesson_steps` WRITE;
/*!40000 ALTER TABLE `lesson_steps` DISABLE KEYS */;
INSERT INTO `lesson_steps` VALUES
('step-1770096895783','lesson-1769212602954',1,'Chemical Formula & Key Properties','<p data-path-to-node=\"3\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important;\">This slide introduces the technical foundation of the caffeine molecule.</p><ul data-path-to-node=\"4\" style=\"padding-inline-start: 32px; font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\"><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,0,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,0,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">Title:</b> Caffeine: A Natural Stimulant</p></li><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,1,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,1,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">Chemical Formula:</b> </p><div data-path-to-node=\"4,1,1\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><div class=\"math-block\" data-math=\"C_8H_{10}N_4O_2\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">$$C_8H_{10}N_4O_2$$</div></div></li><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,2,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,2,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">IUPAC Name:</b> 1,3,7-Trimethylpurine-2,6-dione</p></li><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,3,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,3,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">Key Characteristics:</b></p><ul data-path-to-node=\"4,3,1\" style=\"padding-inline-start: 32px; line-height: 1.15 !important; margin-top: 0px !important;\"><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,3,1,0,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,3,1,0,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">Molar Mass:</b> Approximately <span class=\"math-inline\" data-math=\"194.19 \\text{ g/mol}\" data-index-in-node=\"26\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">$194.19 \\text{ g/mol}$</span>.</p></li><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,3,1,1,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,3,1,1,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">Class:</b> A methylxanthine alkaloid.</p></li><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,3,1,2,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,3,1,2,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">Physical Appearance:</b> White crystalline powder with a distinctly bitter taste.</p></li><li style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><p data-path-to-node=\"4,3,1,3,0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><b data-path-to-node=\"4,3,1,3,0\" data-index-in-node=\"0\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">Mechanism:</b> Acts as an adenosine receptor antagonist in the brain, effectively preventing the sensation of drowsiness.</p></li></ul></li></ul>',NULL,NULL,'/api/uploads/lesson_caffeine_molecule_1769212602954/image.png','read',NULL),
('step-1770097736246','lesson-1769212602954',2,'Step 2','<p data-path-to-node=\"4\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important;\"><span class=\"citation-19 citation-end-19\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">The chemical formula for caffeine is <source-footnote ng-version=\"0.0.0-PLACEHOLDER\" _nghost-ng-c1107229489=\"\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><sup _ngcontent-ng-c1107229489=\"\" class=\"superscript\" data-turn-source-index=\"1\" style=\"line-height: 1.15 !important; margin-top: 0px !important; font-size: 16px !important; background-color: transparent !important;\"><!----></sup></source-footnote></span><b data-path-to-node=\"4\" data-index-in-node=\"37\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">$C_8H_{10}N_4O_2$</b><span class=\"citation-18 citation-end-18\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">.<source-footnote ng-version=\"0.0.0-PLACEHOLDER\" _nghost-ng-c1107229489=\"\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><sup _ngcontent-ng-c1107229489=\"\" class=\"superscript\" data-turn-source-index=\"2\" style=\"line-height: 1.15 !important; margin-top: 0px !important; font-size: 16px !important; background-color: transparent !important;\"><!----></sup></source-footnote></span> <span class=\"citation-17\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">It belongs to a class of compounds called </span><b data-path-to-node=\"4\" data-index-in-node=\"96\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">methylxanthines</b><span class=\"citation-17 citation-end-17\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\">.<br></span></p><ul data-path-to-node=\"5\" style=\"padding-inline-start: 32px; font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\"><li><b data-path-to-node=\"5,0,0\" data-index-in-node=\"0\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif; font-size: 0.875rem;\">The Purine Core:</b><span style=\"font-family: &quot;Google Sans Text&quot;, sans-serif; font-size: 0.875rem;\"> Its structure is based on the purine ring system—a fused double-ring structure consisting of a six-membered pyrimidine ring and a five-membered imidazole ring.</span></li><li><b data-path-to-node=\"5,1,0\" data-index-in-node=\"0\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\">Methyl Groups:</b><span class=\"citation-16\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\"> The name </span><i data-path-to-node=\"5,1,0\" data-index-in-node=\"24\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\">1,3,7-trimethylxanthine</i><span class=\"citation-16 citation-end-16\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\"> tells us that three methyl groups (<source-footnote ng-version=\"0.0.0-PLACEHOLDER\" _nghost-ng-c1107229489=\"\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><sup _ngcontent-ng-c1107229489=\"\" class=\"superscript\" data-turn-source-index=\"4\" style=\"line-height: 1.15 !important; margin-top: 0px !important; font-size: 16px !important; background-color: transparent !important;\"><!----></sup></source-footnote></span><span class=\"math-inline\" data-math=\"-CH_3\" data-index-in-node=\"83\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\">$-CH_3$</span><span class=\"citation-15 citation-end-15\" style=\"font-family: &quot;Google Sans Text&quot;, sans-serif !important; line-height: 1.15 !important; margin-top: 0px !important;\">) are attached to the nitrogen atoms of the xanthine skeleton.<source-footnote ng-version=\"0.0.0-PLACEHOLDER\" _nghost-ng-c1107229489=\"\" style=\"line-height: 1.15 !important; margin-top: 0px !important;\"><sup _ngcontent-ng-c1107229489=\"\" class=\"superscript\" data-turn-source-index=\"5\" style=\"line-height: 1.15 !important; margin-top: 0px !important; font-size: 16px !important; background-color: transparent !important;\"><!----></sup></source-footnote></span> These groups are crucial because they make the molecule lipophilic (fat-soluble), allowing it to cross the blood-brain barrier easily.</li></ul><div><span class=\"citation-14\">The most important aspect of caffeine’s 3D structure is its striking resemblance to </span><b data-path-to-node=\"8\" data-index-in-node=\"84\">Adenosine</b><span class=\"citation-14 citation-end-14\">, a naturally occurring nucleoside in the brain.<br><b data-path-to-node=\"9,0,0\" data-index-in-node=\"0\">Planar Geometry:</b><span class=\"citation-13 citation-end-13\"> The fused rings are relatively flat.<source-footnote ng-version=\"0.0.0-PLACEHOLDER\" _nghost-ng-c1107229489=\"\"><sup _ngcontent-ng-c1107229489=\"\" class=\"superscript\" data-turn-source-index=\"7\"><!----></sup></source-footnote></span> This \"flatness\" allows the molecule to slide into specific cellular receptors.<br><b data-path-to-node=\"9,1,0\" data-index-in-node=\"0\"><span class=\"citation-12\">The \"Lock and Key\":</span></b><span class=\"citation-12 citation-end-12\"> Because caffeine looks so much like adenosine, it acts as a \"molecular imposter.\"<source-footnote ng-version=\"0.0.0-PLACEHOLDER\" _nghost-ng-c1107229489=\"\"><sup _ngcontent-ng-c1107229489=\"\" class=\"superscript\" data-turn-source-index=\"8\"><!----></sup></source-footnote></span> It fits into adenosine receptors but doesn\'t activate them, effectively acting as a <b data-path-to-node=\"9,1,0\" data-index-in-node=\"186\">competitive antagonist</b>.</span><font face=\"Google Sans Text, sans-serif\"></font></div>','6jwihtagv',NULL,NULL,'read',NULL),
('step-1770097916276','lesson-1769212602954',3,'Common Sources of Caffeine','<p data-path-to-node=\"2,0,0\"><b data-path-to-node=\"2,0,0\" data-index-in-node=\"0\">Natural Plant Sources:</b></p><ul data-path-to-node=\"2,0,1\"><li><p data-path-to-node=\"2,0,1,0,0\"><b data-path-to-node=\"2,0,1,0,0\" data-index-in-node=\"0\">Coffee Beans:</b> The most prevalent source (Arabica and Robusta varieties).</p></li><li><p data-path-to-node=\"2,0,1,1,0\"><b data-path-to-node=\"2,0,1,1,0\" data-index-in-node=\"0\">Tea Leaves:</b> Found in Black, Green, and Oolong teas (contains \"theine\").</p></li><li><p data-path-to-node=\"2,0,1,2,0\"><b data-path-to-node=\"2,0,1,2,0\" data-index-in-node=\"0\">Cocoa Beans:</b> Used in chocolate and cocoa-based products.</p></li></ul><div><p data-path-to-node=\"2,1,0\"><b data-path-to-node=\"2,1,0\" data-index-in-node=\"0\">Commercial &amp; Synthetic Sources:</b></p><ul data-path-to-node=\"2,1,1\"><li><p data-path-to-node=\"2,1,1,0,0\"><b data-path-to-node=\"2,1,1,0,0\" data-index-in-node=\"0\">Soft Drinks:</b> Colas and various flavored sodas.</p></li><li><p data-path-to-node=\"2,1,1,1,0\"><b data-path-to-node=\"2,1,1,1,0\" data-index-in-node=\"0\">Energy Drinks:</b> High concentrations of either natural or synthetic caffeine.</p></li></ul></div>',NULL,NULL,'/api/uploads/lesson_caffeine_molecule_1769212602954/image_1770098296775.png','read',NULL),
('step-1770098310030','lesson-1769212602954',4,'Chemical Composition','Based on the chemical formula $C_8H_{10}N_4O_2$, which of the following elements is NOT present in a caffeine molecule?',NULL,NULL,NULL,'quiz','{\"type\":\"single\",\"options\":[\"Nitrogen (N)\",\"Phosphorus (P)\",\"Carbon (C)\"],\"correctIndex\":1,\"correctIndices\":[0],\"targetMesh\":\"\"}'),
('step-1770098507226','lesson-1769212602954',5,'Biological Mechanism','<div>Which neurotransmitter does caffeine primarily block in the brain to prevent sleepiness?</div>',NULL,NULL,NULL,'quiz','{\"type\":\"single\",\"options\":[\"Adenosine\",\"Adrenaline\",\"Adopamine\",\"Serotonin\"],\"correctIndex\":0,\"correctIndices\":[0],\"targetMesh\":\"\"}'),
('step-1770098633826','lesson-1769212602954',6,'Sources & Properties','<div>Which of the following statements regarding the sources and properties of caffeine are TRUE? (Select all that apply)</div><div><br></div><div><br></div>',NULL,NULL,NULL,'quiz','{\"type\":\"multiple\",\"options\":[\"Guarana seeds typically contain a higher concentration of caffeine than coffee beans\",\"Caffeine is a purely synthetic compound that does not occur in nature\",\"Caffeine is often added to pharmaceutical painkillers to enhance their effectiveness\",\"Pure caffeine is a blue liquid with a sweet taste\"],\"correctIndex\":0,\"correctIndices\":[0,2],\"targetMesh\":\"\"}'),
('step-1770098807211','lesson-1769212602954',7,'Natural Sources','Which of these plants is known for containing caffeine?',NULL,NULL,NULL,'quiz','{\"type\":\"single\",\"options\":[\"Sunflower seeds\",\"Yerba Mate\",\"Peppermint leaves\",\"Chamomile\"],\"correctIndex\":1,\"correctIndices\":[0],\"targetMesh\":\"\"}'),
('step-1770098904985','lesson-1769212602954',8,'Step 8','<div>Caffeine is a member of the methylxanthine class of alkaloids.</div><div><br></div><div><br></div>',NULL,NULL,NULL,'quiz','{\"type\":\"true_false\",\"options\":[\"\",\"\"],\"correctIndex\":0,\"correctIndices\":[0],\"targetMesh\":\"\"}'),
('step-1770098934880','lesson-1769212602954',9,'Step 9','If you were looking at the 3D mesh of a caffeine molecule, which Mesh ID would be responsible for the \"mimicry\" effect that allows caffeine to bind to human brain receptors?<div>(double bond ($C=O$))</div>','6jwihtagv',NULL,NULL,'find_part','{\"targetMesh\":\"doubleCO\"}');
/*!40000 ALTER TABLE `lesson_steps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lessons`
--

DROP TABLE IF EXISTS `lessons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lessons` (
  `id` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `sector_id` varchar(50) DEFAULT NULL,
  `author_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `image_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sector_id` (`sector_id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `lessons_ibfk_1` FOREIGN KEY (`sector_id`) REFERENCES `sectors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `lessons_ibfk_2` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lessons`
--

LOCK TABLES `lessons` WRITE;
/*!40000 ALTER TABLE `lessons` DISABLE KEYS */;
INSERT INTO `lessons` VALUES
('lesson-1769212602954','Caffeine molecule','Caffeine is a natural stimulant that boosts alertness by acting as a \"molecular imposter,\" structurally mimicking adenosine to block sleep signals in the brain.','Chemistry','user-001','2026-01-23 23:56:42','/api/uploads/lesson_caffeine_molecule_1769212602954/file-1769213874977-232505245.png');
/*!40000 ALTER TABLE `lessons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `models`
--

DROP TABLE IF EXISTS `models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `models` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `sector` varchar(50) DEFAULT NULL,
  `equipmentType` varchar(100) DEFAULT NULL,
  `level` varchar(50) DEFAULT NULL,
  `modelUrl` varchar(500) DEFAULT NULL,
  `thumbnailUrl` varchar(500) DEFAULT NULL,
  `optimized` tinyint(1) DEFAULT NULL,
  `fileSize` bigint(20) DEFAULT NULL,
  `uploadedBy` varchar(100) DEFAULT NULL,
  `createdAt` date DEFAULT NULL,
  `isFeatured` tinyint(1) DEFAULT 0,
  `optimizedUrl` varchar(255) DEFAULT NULL,
  `aiAnalysis` text DEFAULT NULL,
  `optimizationStats` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sector` (`sector`),
  CONSTRAINT `models_ibfk_1` FOREIGN KEY (`sector`) REFERENCES `sectors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `models`
--

LOCK TABLES `models` WRITE;
/*!40000 ALTER TABLE `models` DISABLE KEYS */;
INSERT INTO `models` VALUES
('0f8eht4ys','MultiMeter','MultiMeter','Chemistry','MultiMeter','Basic','/api/uploads/multimeter___free_3qp0f5/scene.gltf','/api/uploads/multimeter___free_3qp0f5/image.png',1,29275741,'boban.blagojevic','2026-02-04',0,NULL,NULL,NULL),
('6jwihtagv','Caffeine','The caffeine molecule (C8H10N4O2) is a bitter, white powder and a natural stimulant, chemically known as 1,3,7-trimethylxanthine, structurally similar to adenosine, which allows it to block adenosine receptors in the brain, promoting wakefulness and alertness. Its formula shows it contains 8 carbon, 10 hydrogen, 4 nitrogen, and 2 oxygen atoms, forming a structure with two fused rings and three methyl groups that influence its polarity and solubility. ','Chemistry','Molecule','Basic','/api/uploads/pdb_file_1768509131788_633845595_21jq4k/file-1768509131788-633845595.pdb#pdb','/api/uploads/pdb_file_1768509131788_633845595_21jq4k/file-1768509553608-739122869.png',1,253379,'boban.blagojevic','2026-01-15',1,NULL,NULL,NULL),
('91qfmmayk','Lycopene','Lycopene','Chemistry','Molecule','Basic','/api/uploads/pdb_lycopene_c06q0g/lycopene.pdb#pdb','/api/uploads/pdb_lycopene_c06q0g/image.png',1,6955,'boban.blagojevic','2026-02-03',0,NULL,NULL,NULL),
('9aiglhz9f','2CylinderEngine','2CylinderEngine','Chemistry','2CylinderEngine','Basic','/api/uploads/2cylinderengine_tby25t/2CylinderEngine.gltf','/api/uploads/2cylinderengine_tby25t/image.png',1,601166,'boban.blagojevic','2026-02-03',1,NULL,NULL,NULL),
('9q31l5l3y','Aspirin','Aspirin','Chemistry','Molecule','Basic','/api/uploads/pdb_aspirin_hpo2to/aspirin.pdb#pdb','/api/uploads/pdb_aspirin_hpo2to/image.png',1,1628,'boban.blagojevic','2026-02-03',0,NULL,NULL,NULL),
('e1koihg5u','Charité University Hospital - Operating Room','Charité University Hospital - Operating Room','Medicine','Operating Room','Basic','/api/uploads/charite_university_hospital___operating_room_at3kiz/charite_university_hospital_-_operating_room.glb','/api/uploads/charite_university_hospital___operating_room_at3kiz/image.png',1,46555604,'boban.blagojevic','2026-02-04',0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `models` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nonces`
--

DROP TABLE IF EXISTS `nonces`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nonces` (
  `nonce` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`nonce`),
  UNIQUE KEY `nonces_nonce` (`nonce`(50)),
  KEY `nonces_created_at` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nonces`
--

LOCK TABLES `nonces` WRITE;
/*!40000 ALTER TABLE `nonces` DISABLE KEYS */;
/*!40000 ALTER TABLE `nonces` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platformStatuses`
--

DROP TABLE IF EXISTS `platformStatuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `platformStatuses` (
  `id` varchar(255) NOT NULL,
  `active` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_statuses_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platformStatuses`
--

LOCK TABLES `platformStatuses` WRITE;
/*!40000 ALTER TABLE `platformStatuses` DISABLE KEYS */;
/*!40000 ALTER TABLE `platformStatuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platforms`
--

DROP TABLE IF EXISTS `platforms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `platforms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `platformName` text DEFAULT NULL,
  `platformUrl` text DEFAULT NULL,
  `clientId` text DEFAULT NULL,
  `authEndpoint` text DEFAULT NULL,
  `accesstokenEndpoint` text DEFAULT NULL,
  `kid` text DEFAULT NULL,
  `authConfig` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`authConfig`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `authorizationServer` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platforms_platform_url_client_id` (`platformUrl`(50),`clientId`(50)),
  UNIQUE KEY `platforms_kid` (`kid`(50)),
  KEY `platforms_platform_url` (`platformUrl`(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platforms`
--

LOCK TABLES `platforms` WRITE;
/*!40000 ALTER TABLE `platforms` DISABLE KEYS */;
/*!40000 ALTER TABLE `platforms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `privatekeys`
--

DROP TABLE IF EXISTS `privatekeys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `privatekeys` (
  `kid` varchar(255) NOT NULL,
  `platformUrl` text DEFAULT NULL,
  `clientId` text DEFAULT NULL,
  `iv` text DEFAULT NULL,
  `data` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`kid`),
  UNIQUE KEY `privatekeys_kid` (`kid`(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `privatekeys`
--

LOCK TABLES `privatekeys` WRITE;
/*!40000 ALTER TABLE `privatekeys` DISABLE KEYS */;
/*!40000 ALTER TABLE `privatekeys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `publickeys`
--

DROP TABLE IF EXISTS `publickeys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `publickeys` (
  `kid` varchar(255) NOT NULL,
  `platformUrl` text DEFAULT NULL,
  `clientId` text DEFAULT NULL,
  `iv` text DEFAULT NULL,
  `data` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`kid`),
  UNIQUE KEY `publickeys_kid` (`kid`(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `publickeys`
--

LOCK TABLES `publickeys` WRITE;
/*!40000 ALTER TABLE `publickeys` DISABLE KEYS */;
/*!40000 ALTER TABLE `publickeys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scores`
--

DROP TABLE IF EXISTS `scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `scores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `model_id` varchar(255) NOT NULL,
  `time_seconds` float NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scores`
--

LOCK TABLES `scores` WRITE;
/*!40000 ALTER TABLE `scores` DISABLE KEYS */;
/*!40000 ALTER TABLE `scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sectors`
--

DROP TABLE IF EXISTS `sectors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sectors` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sectors`
--

LOCK TABLES `sectors` WRITE;
/*!40000 ALTER TABLE `sectors` DISABLE KEYS */;
INSERT INTO `sectors` VALUES
('CHEMISTRY','Chemistry',NULL),
('CONSTRUCTION','Construction',NULL),
('ELECTRICAL','Electrical Engineering',NULL),
('ICT','ICT',NULL),
('MECHANICAL','Mechanical Engineering',NULL),
('Mechanical Engineering','Mechanical Engineering','Custom User Sector'),
('MECHATRONICS','Mechatronics',NULL),
('Medicine','Medicine','Custom User Sector');
/*!40000 ALTER TABLE `sectors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `states`
--

DROP TABLE IF EXISTS `states`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `states` (
  `state` varchar(255) NOT NULL,
  `query` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`query`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`state`),
  UNIQUE KEY `states_state` (`state`(50)),
  KEY `states_created_at` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `states`
--

LOCK TABLES `states` WRITE;
/*!40000 ALTER TABLE `states` DISABLE KEYS */;
/*!40000 ALTER TABLE `states` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES
('ai_language','Auto'),
('ai_model','gemini-2.0-flash-lite-preview-02-05'),
('ai_temperature','0.7'),
('allow_public_registration','true'),
('brand_color','#4f46e5'),
('brand_name','THE GEAR'),
('challenge_duration_days','7'),
('gemini_api_key','AIzaSyBSN4fvlARS24B7rN9GnKWCm-cDUH242VQ'),
('global_announcement',''),
('maintenance_mode','false'),
('material_project_api_key','JW5B5OrElJKt1JurUIQvvqAHu7RGUaUb'),
('max_file_size_mb','128'),
('moodle_client_id',''),
('moodle_url',''),
('show_leaderboard','true');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(50) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `institution` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `profilePicUrl` varchar(500) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT current_timestamp(),
  `role` enum('admin','teacher','student') DEFAULT 'student',
  `language` varchar(10) DEFAULT 'en',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
('user-001','boban.blagojevic','boban.blagojevic@tsp.edu.rs','$2b$10$PAF1cXBdJv9TXqC238mnx.M.So3KP.mwFTDakv4w0rHUa1eWktU66','Technical School Pirot','','/api/uploads/profile_pictures/bb.jpg','2026-01-21 04:12:32','admin','en'),
('user-1768969039464','student1','student1@gear.com','Tsp-2024','TSP',NULL,NULL,'2026-01-21 04:17:19','student','en'),
('user-1768971278021','teacher1','teacher1@tsp.edu.rs','Tsp-2024','TSP',NULL,NULL,'2026-01-21 04:54:38','teacher','en'),
('user-test','testadmin','test@tsp.edu.rs','$2b0$p.BKR/ybmyywR0XUeQd4su1lYsFn.U2oHCgLyLZM.YbD8WgisfYSO',NULL,NULL,NULL,'2026-02-03 07:42:30','admin','en');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workshops`
--

DROP TABLE IF EXISTS `workshops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `workshops` (
  `id` varchar(50) NOT NULL,
  `modelId` varchar(50) DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `status` enum('active','ended') DEFAULT 'active',
  `createdAt` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `modelId` (`modelId`),
  KEY `createdBy` (`createdBy`),
  CONSTRAINT `workshops_ibfk_1` FOREIGN KEY (`modelId`) REFERENCES `models` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workshops_ibfk_2` FOREIGN KEY (`createdBy`) REFERENCES `users` (`username`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workshops`
--

LOCK TABLES `workshops` WRITE;
/*!40000 ALTER TABLE `workshops` DISABLE KEYS */;
INSERT INTO `workshops` VALUES
('ws-1769124257017','6jwihtagv','boban.blagojevic','active','2026-01-22 23:24:17');
/*!40000 ALTER TABLE `workshops` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-19  7:41:22
