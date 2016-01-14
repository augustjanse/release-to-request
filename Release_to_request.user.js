// ==UserScript==
// @name        Release to request
// @description	Import metadata from a MusicBrainz release group into a What.CD request
// @namespace   http://janse.se/
// @include     https://what.cd/requests.php?action=new
// @version     0.1
// @grant       none
// ==/UserScript==

var debugging = false;

$("tbody").prepend('<tr> <td class="label">Import from MusicBrainz</td> <td> <input id="mbid_box" size="8" value="" type="text"> <input value="Import" id="mbid_button" type="button"> </td> </tr>');
$("#mbid_button").click(importMetadata);

if(debugging) {
	$("#mbid_box").val("0e5b4580-4e6d-43e6-8384-0d13ac52a9d7");
	$("#mbid_button").click();
}

function importMetadata(){
	reset();

	var input = $("#mbid_box").val();
	var mbid = input.match("[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+")[0];
	entity = null;
	setEntity(input, mbid);
	console.log(entity + " found");

	url = 'http://musicbrainz.org/release-group/' + mbid;

	if (entity == "release-group") {
		// get metadata from release group
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release-group/' + mbid + '?inc=artists',
			success: enterReleaseGroup,
			error: function(xml) {
				console.log("Release group request failed");
			}
		});

		// get links from connected releases
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release?release-group=' + mbid + '&inc=url-rels',
			success: setDescription,
			error: function(xml) {
				console.log("Release request failed");
			}
		});
	} else if (entity == "release") {
		// get release metadata
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release/' + mbid + '?inc=artists+release-groups+url-rels',
			success: enterRelease,
			error: function(xml) {
				console.log("Release request failed");
			}
		});
	}

	// allow all formats, bitrates and media
	$('#toggle_formats').prop("checked", true).change();
	$('#toggle_bitrates').prop("checked", true).change();
	$('#toggle_media').prop("checked", true).change();
}

function enterReleaseGroup(xml) {
	// get metadata from XML
	var title = $(xml).find("title").text();
	var year = $(xml).find("first-release-date").text().match("[0-9]{4}")[0];
	var type = matchType(xml, $("#categories"));

	// enter metadata in form
	setArtists(xml);
	$('[name="title"]').val(title);	
	$('[name="year"]').val(year);	
	var dd_val = $('select option').filter(function () { return $(this).html() == type;}).val(); 
	$('#releasetype').val(dd_val);
}

function enterRelease(xml) {
	setDescription(xml);
}

function listUrls(xml, type, intro) {
	var list = "";

	$(xml).find('[type="' + type + '"] target').each(function() {
		if (list == "") {
			list += "[b]" + intro + "[/b]\n";
		}

		url = $(this).text();
		if (url.indexOf("itunes.apple.com") != -1) {
			setCoverArt(url);
		}	
		list += "[*]" + url + "\n";
	});
	
	if (list != "") {	
		text += list;
	}
}

function matchType(xml, categoryDropdown) {
	// "Audiobook" matches to the "Audiobooks" category
	if($(xml).find("secondary-type").text().indexOf("Audiobook") != -1) {
		categoryDropdown.val("Audiobooks").change();	
	}

	var type = null;
	// try all secondary types
	$(xml).find("secondary-type").each(function() {
	switch ($(this).text()) {
		// types named the same
		case "Compilation":
		case "Soundtrack":
		case "Interview":
		case "Remix":
			type = $(this).text();
			return false;
		
		// types named slightly differently
		case "Live":
			type = "Live album";
			return false;
		case "DJ-mix":
			type = "DJ Mix";
			return false;
		case "Mixtape/Street":
			type = "Mixtape";
			return false;

		// "Soundtrack" has no equivalent
		}
	});

	// return if match found
	if (type != null) {
		return type;
	}

	// use primary type if no match on secondary type
	switch ($(xml).find("primary-type").text()) {
		case "Album":
		case "Single":
		case "EP":
			type = $(xml).find("primary-type").text();
			break;

		// no match for "Broadcast" or "Other"
	}

	// if no match, return null
	return type;
}

function setCoverArt(url) {
	$.ajax({
		type: "GET",
		url: url,
		success: function(data) {
			image = $(data).find("#left-stack img.artwork").attr("src-swap-high-dpi").replace("340x340", "1200x1200");
			$('[name="image"]').val(image);
		},
		error: function() { console.log("iTunes request failed"); }
	});
}

function reset() {
	$('select option:first-child').attr("selected", "selected").change();
	$('input[type="text"]:not(#mbid_box)').val("");
	$('textarea[name="description"]').val("");

	while ($("#artistfields input").length != 1) {
		$("#artistfields a.brackets:nth-of-type(2)").click();
	}
}

function setArtists(xml) {
	var guest = false;
	$(xml).find("name-credit").each(function(index) {
		// do for all but the first
		if (index != 0) {
			$("#artistfields a.brackets:nth-of-type(1)").click();
		}

		var artist = $(this).find("artist name").text();
		$('[name="artists[]"]').eq(index).val(artist);	
		
		if ($(this).prev().attr("joinphrase") == " feat. ") {
			guest = true;
		}

		if (guest) {
			$('[name="importance[]"]').eq(index).val(2);	
		}
	});
}

// Examine the type of entity by performing AJAX requests
function setEntity(input, mbid) {
	if (input.indexOf("release-group") != -1) {
		entity = "release-group";
	} else if (input.indexOf("release") != -1) {
		entity = "release";
	} else {
		// if entity not stated in input
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release-group/' + mbid,
			success: function() { entity = "release-group"; },
			error: function() { console.log("Entity is not release group"); },
			async: false
		});

		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release/' + mbid,
			success: function() { entity = "release"; },
			error: function() { console.log("Entity is not release"); },
			async: false
		});
	}
}

function setDescription(xml) {
	// get URL relationships
	text = "Any release of this accepted. Thanks!\n\n";
	text += "[b]MusicBrainz[/b]\n[*]" + url + "\n";

	listUrls(xml, "download for free", "Download for free");
	listUrls(xml, "purchase for download", "Purchase for download");
	listUrls(xml, "purchase for mail-order", "Purchase for mail-order");
	listUrls(xml, "amazon asin", "Amazon");

	$('textarea[name="description"]').val(text.trim());
}
