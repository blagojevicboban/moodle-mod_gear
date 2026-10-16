@mod @mod_gear
Feature: Basic GEAR activity view and permissions
  In order to learn with interactive 3D scenes
  As a teacher and student
  I need to view GEAR activities and respect management permissions

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email                |
      | teacher1 | Teacher   | One      | teacher1@example.com |
      | student1 | Student   | One      | student1@example.com |
    And the following "courses" exist:
      | fullname | shortname | category |
      | Course 1 | C1        | 0        |
    And the following "course enrolments" exist:
      | user     | course | role           |
      | teacher1 | C1     | editingteacher |
      | student1 | C1     | student        |
    And the following "activities" exist:
      | activity | name       | intro                  | course | idnumber |
      | gear     | Empty GEAR | Activity without model | C1     | gear1    |
      | gear     | Demo GEAR  | Activity with model    | C1     | gear2    |
    And the following "mod_gear > models" exist:
      | gear      | name         |
      | Demo GEAR | triangle.glb |
    And the following "mod_gear > hotspots" exist:
      | gear      | title        | content           |
      | Demo GEAR | First Point  | <p>Hello Gear</p> |

  Scenario: Viewing a GEAR activity without any 3D model displays a notice
    When I am on the "Empty GEAR" "gear activity" page logged in as student1
    Then I should see "No 3D models have been added to this activity."

  Scenario: Teacher sees analytics link while student does not
    When I am on the "Demo GEAR" "gear activity" page logged in as teacher1
    Then "a[href*='/mod/gear/report.php']" "css_element" should exist
    When I am on the "Demo GEAR" "gear activity" page logged in as student1
    Then "a[href*='/mod/gear/report.php']" "css_element" should not exist
